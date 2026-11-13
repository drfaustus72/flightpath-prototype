import { distanceNm } from './geo'
import { flightsInOrder } from './recognition'
import { isVerifiedCfi } from './tiers'
import type { Airport, Club, Flight, Mission, MissionClaim, MissionVerification, World } from './types'
import { isStaffOfClub } from './visibility'

/**
 * Missions (brief section 7). Completion is worked out from the track, like stamps; the only
 * thing stored is a verification, and only a verification can earn XP (CLAUDE.md rule 7).
 * Missions marked cfiOnly can't be seen in a track: the flight's instructor verifies them.
 */

function airportMap(world: World): Map<string, Airport> {
  return new Map(world.airports.map((a) => [a.icao, a]))
}

/** Whether a flight's track shows everything the mission asks for. */
export function flightMeetsMission(world: World, flight: Flight, mission: Mission): boolean {
  const r = mission.requirements
  if (r.cfiOnly) return false
  if (flight.isSimulator && !(mission.simEligible && flight.simConfirmation?.status === 'confirmed')) return false

  const airports = airportMap(world)
  const dep = flight.departure ? airports.get(flight.departure) : undefined
  const start = dep ? { lat: dep.lat, lon: dep.lon } : flight.route[0] ? { lat: flight.route[0][1], lon: flight.route[0][0] } : null

  if (r.landAtAny && !flight.landings.some((l) => l.icao !== null && r.landAtAny?.includes(l.icao))) return false
  if (r.minDistanceFromDepartureNm !== undefined) {
    const min = r.minDistanceFromDepartureNm
    if (!start || !flight.landings.some((l) => distanceNm(start.lat, start.lon, l.lat, l.lon) >= min)) return false
  }
  if (r.minTotalNm !== undefined && flight.stats.distanceNm < r.minTotalNm) return false
  if (r.minFullStopAirports !== undefined) {
    const points = new Set([flight.departure, ...flight.landings.filter((l) => l.kind === 'full_stop').map((l) => l.icao)])
    points.delete(null)
    if (points.size < r.minFullStopAirports) return false
  }
  if (r.minFieldElevationFt !== undefined) {
    const min = r.minFieldElevationFt
    if (!flight.landings.some((l) => (l.icao ? (airports.get(l.icao)?.elevationFt ?? -Infinity) : -Infinity) >= min)) return false
  }
  return true
}

export function activeVerification(world: World, pilotId: string, missionCode: string): MissionVerification | undefined {
  return world.missionVerifications.find((v) => v.pilotId === pilotId && v.missionCode === missionCode && v.revoked === null)
}

export function claimFor(world: World, pilotId: string, missionCode: string): MissionClaim | undefined {
  return world.missionClaims.find((c) => c.pilotId === pilotId && c.missionCode === missionCode)
}

export interface MissionStatus {
  mission: Mission
  /** First flight whose track completes it (null for cfiOnly missions until verified). */
  flight: Flight | null
  verification: MissionVerification | null
  /** The pilot's own report that they flew it. */
  claim: MissionClaim | null
  complete: boolean
  /** How we know: the school verified it, the track shows it, or the pilot says so. */
  source: 'verified' | 'tracked' | 'self_reported' | null
}

export function missionStatus(world: World, pilotId: string, mission: Mission): MissionStatus {
  const verification = activeVerification(world, pilotId, mission.code) ?? null
  const claim = claimFor(world, pilotId, mission.code) ?? null
  const ordered = flightsInOrder(world.flights.filter((f) => f.pilotId === pilotId))
  const detected = ordered.find((f) => flightMeetsMission(world, f, mission)) ?? null
  const verifiedFlight = verification?.flightId ? (world.flights.find((f) => f.id === verification.flightId) ?? null) : null
  const source = verification ? 'verified' : detected ? 'tracked' : claim ? 'self_reported' : null
  return { mission, flight: detected ?? verifiedFlight, verification, claim, complete: source !== null, source }
}

export function missionStatuses(world: World, pilotId: string): MissionStatus[] {
  return world.missions.map((m) => missionStatus(world, pilotId, m))
}

/** Missions this flight completed for the first time (shown as "Mission complete"). */
export function missionsCompletedOn(world: World, flight: Flight): Mission[] {
  return missionStatuses(world, flight.pilotId)
    .filter((s) => s.flight?.id === flight.id)
    .map((s) => s.mission)
}

export function missionByCode(world: World, code: string): Mission | undefined {
  return world.missions.find((m) => m.code === code)
}

function xpClub(world: World, clubId: string | null): Club | undefined {
  const c = clubId ? world.clubs.find((x) => x.id === clubId) : undefined
  return c && c.plan === 'school_pro' && c.claimed ? c : undefined
}

/**
 * Who may verify a mission on a flight (decided 13 Nov 2026):
 *  - track-detected missions: an admin or staff CFI of the School Pro school the flight is tagged to;
 *  - cfiOnly missions: the flight's accepted instructor, any verified CFI (never paywalled).
 * Never the pilot, and only once per pilot and mission.
 */
export function canVerifyMission(world: World, accountId: string, flight: Flight, mission: Mission): boolean {
  if (accountId === flight.pilotId) return false
  if (activeVerification(world, flight.pilotId, mission.code)) return false
  if (mission.requirements.cfiOnly) {
    const cfi = world.accounts.find((a) => a.id === accountId)
    const isInstructor = flight.instructor?.accountId === accountId && flight.instructor.status === 'accepted'
    return isInstructor && cfi !== undefined && isVerifiedCfi(cfi) && !flight.isSimulator
  }
  const club = xpClub(world, flight.clubId)
  return club !== undefined && isStaffOfClub(world, accountId, club.id) && flightMeetsMission(world, flight, mission)
}

/** The school a verification is recorded for: XP accrues there only if it's School Pro. */
export function verificationClubId(world: World, accountId: string, flight: Flight): string | null {
  const club = xpClub(world, flight.clubId)
  return club && isStaffOfClub(world, accountId, club.id) ? club.id : null
}

/**
 * School Pro schools where this staff member can verify a self-reported mission for the pilot:
 * the staff member is an admin or staff CFI there and the pilot is an active member.
 */
export function claimVerificationClubs(world: World, accountId: string, pilotId: string): Club[] {
  if (accountId === pilotId) return []
  const pilotClubs = new Set(world.memberships.filter((m) => m.accountId === pilotId && m.status === 'active').map((m) => m.clubId))
  return world.clubs.filter((c) => c.plan === 'school_pro' && c.claimed && pilotClubs.has(c.id) && isStaffOfClub(world, accountId, c.id))
}

/** A self-reported mission (no track) the school can verify after checking with the pilot. */
export function canVerifyClaim(world: World, accountId: string, pilotId: string, mission: Mission): boolean {
  if (!claimFor(world, pilotId, mission.code) || activeVerification(world, pilotId, mission.code)) return false
  return claimVerificationClubs(world, accountId, pilotId).length > 0
}

export type MissionToVerify =
  | { kind: 'tracked'; pilotId: string; mission: Mission; flight: Flight }
  | { kind: 'self_reported'; pilotId: string; mission: Mission; claim: MissionClaim; clubs: Club[] }

/**
 * What waits for this school staff member. Tagging a flight to the school is the submission:
 * every mission it completes lands here automatically (decided 13 Nov 2026). Self-reported
 * missions from the school's members land here too, for the school to check and verify.
 */
export function missionsToVerify(world: World, accountId: string): MissionToVerify[] {
  const pilots = [...new Set([...world.flights.map((f) => f.pilotId), ...world.missionClaims.map((c) => c.pilotId)])]
  return world.missions.flatMap((mission) =>
    pilots.flatMap((pilotId): MissionToVerify[] => {
      if (!mission.requirements.cfiOnly) {
        const flight = flightsInOrder(world.flights.filter((f) => f.pilotId === pilotId)).find((f) =>
          canVerifyMission(world, accountId, f, mission),
        )
        if (flight) return [{ kind: 'tracked', pilotId, mission, flight }]
      }
      const claim = claimFor(world, pilotId, mission.code)
      if (claim && canVerifyClaim(world, accountId, pilotId, mission)) {
        return [{ kind: 'self_reported', pilotId, mission, claim, clubs: claimVerificationClubs(world, accountId, pilotId) }]
      }
      return []
    }),
  )
}

export const MISSION_LABELS: Record<Mission['label'], string> = {
  adventure: 'Adventure only',
  potentially_qualifying: 'Potentially qualifying FAA experience',
  cfi_verified: 'CFI-verified training',
}
