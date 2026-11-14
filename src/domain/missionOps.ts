import { canJoinChallenge } from './challenges'
import { canVerifyClaim, canVerifyMission, claimFor, claimVerificationClubs, missionByCode, verificationClubId } from './missions'
import type { OpContext } from './socialOps'
import type { World } from './types'

/** State transitions for missions, challenges and no-gos. Rule violations throw (see socialOps). */

export function verifyMission(world: World, actorId: string, flightId: string, missionCode: string, ctx: OpContext): World {
  const flight = world.flights.find((f) => f.id === flightId)
  const mission = missionByCode(world, missionCode)
  if (!flight || !mission || !canVerifyMission(world, actorId, flight, mission)) throw new Error("Can't verify this mission")
  const clubId = verificationClubId(world, actorId, flight)
  const verification = {
    id: ctx.id,
    pilotId: flight.pilotId,
    missionCode,
    flightId,
    clubId,
    // A tracked flight tagged to the school was flown in its aircraft.
    schoolAircraft: clubId !== null,
    byAccountId: actorId,
    at: ctx.now,
    revoked: null,
  }
  return { ...world, missionVerifications: [...world.missionVerifications, verification] }
}

/**
 * The school verifies a mission the pilot self-reported without a track. The verifier confirms
 * whether it was flown in the school's aircraft; only then does it earn XP.
 */
export function verifyMissionClaim(
  world: World,
  actorId: string,
  pilotId: string,
  missionCode: string,
  clubId: string,
  schoolAircraft: boolean,
  ctx: OpContext,
): World {
  const mission = missionByCode(world, missionCode)
  if (!mission || !canVerifyClaim(world, actorId, pilotId, mission)) throw new Error("Can't verify this mission")
  if (!claimVerificationClubs(world, actorId, pilotId).some((c) => c.id === clubId)) throw new Error(`Can't verify for ${clubId}`)
  const verification = { id: ctx.id, pilotId, missionCode, flightId: null, clubId, schoolAircraft, byAccountId: actorId, at: ctx.now, revoked: null }
  return { ...world, missionVerifications: [...world.missionVerifications, verification] }
}

/** The pilot reports flying a mission (e.g. no track). Lying gains nothing: it never earns XP by itself. */
export function claimMission(world: World, actorId: string, missionCode: string, ctx: OpContext): World {
  if (!missionByCode(world, missionCode)) throw new Error(`Unknown mission ${missionCode}`)
  if (claimFor(world, actorId, missionCode)) return world
  return { ...world, missionClaims: [...world.missionClaims, { pilotId: actorId, missionCode, at: ctx.now }] }
}

export function withdrawMissionClaim(world: World, actorId: string, missionCode: string): World {
  return { ...world, missionClaims: world.missionClaims.filter((c) => !(c.pilotId === actorId && c.missionCode === missionCode)) }
}

/** The verifier, or an admin of the school it was recorded for, can revoke it with a reason. */
export function canRevokeMissionVerification(world: World, actorId: string, verificationId: string): boolean {
  const v = world.missionVerifications.find((x) => x.id === verificationId)
  if (!v || v.revoked !== null) return false
  if (v.byAccountId === actorId) return true
  return world.memberships.some(
    (m) => m.accountId === actorId && m.clubId === v.clubId && m.status === 'active' && m.roles.includes('admin'),
  )
}

export function revokeMissionVerification(world: World, actorId: string, verificationId: string, reason: string, ctx: OpContext): World {
  if (!canRevokeMissionVerification(world, actorId, verificationId)) throw new Error("Can't revoke this verification")
  const why = reason.trim()
  if (why.length === 0) throw new Error('Give a reason for revoking')
  return {
    ...world,
    missionVerifications: world.missionVerifications.map((v) =>
      v.id === verificationId ? { ...v, revoked: { at: ctx.now, reason: why.slice(0, 500) } } : v,
    ),
  }
}

export function joinChallenge(world: World, actorId: string, code: string, ctx: OpContext): World {
  const challenge = world.challenges.find((c) => c.code === code)
  if (!challenge) throw new Error(`Unknown challenge ${code}`)
  if (!canJoinChallenge(world, actorId, challenge)) throw new Error('This challenge isn’t open to you')
  if (world.challengeEntries.some((e) => e.pilotId === actorId && e.challengeCode === code)) return world
  return { ...world, challengeEntries: [...world.challengeEntries, { pilotId: actorId, challengeCode: code, joinedAt: ctx.now }] }
}

export function leaveChallenge(world: World, actorId: string, code: string): World {
  return { ...world, challengeEntries: world.challengeEntries.filter((e) => !(e.pilotId === actorId && e.challengeCode === code)) }
}

export function recordNoGo(world: World, actorId: string, entry: { from: string; to: string | null; reason: string }, ctx: OpContext): World {
  const reason = entry.reason.trim()
  if (reason.length === 0 || reason.length > 500) throw new Error('Say briefly why you decided not to go (up to 500 characters)')
  const known = new Set(world.airports.map((a) => a.icao))
  if (!known.has(entry.from) || (entry.to !== null && !known.has(entry.to))) throw new Error('Unknown airport')
  return { ...world, noGos: [...world.noGos, { id: ctx.id, pilotId: actorId, from: entry.from, to: entry.to, reason, at: ctx.now }] }
}
