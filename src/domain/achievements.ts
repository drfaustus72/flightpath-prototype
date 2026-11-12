import { offersSchoolPlans } from './clubs'
import type { Achievement, Airport, Club, Flight, Membership } from './types'

/** Simulator sessions are logged but never earn airport stamps or badges. */
export function earnsStampsAndBadges(flight: Pick<Flight, 'isSimulator'>): boolean {
  return !flight.isSimulator
}

/**
 * XP (Pilot Pro, M3): real flights always earn it. A simulator session earns it only when
 * tagged to a flight school or flying club the pilot actively belongs to — e.g. a session
 * in the school's sim — AND the school has confirmed it.
 */
export function earnsXp(
  flight: Pick<Flight, 'isSimulator' | 'clubId' | 'pilotId' | 'simConfirmation'>,
  clubs: readonly Club[],
  memberships: readonly Membership[],
): boolean {
  if (!flight.isSimulator) return true
  if (flight.clubId === null || flight.simConfirmation?.status !== 'confirmed') return false
  const club = clubs.find((c) => c.id === flight.clubId)
  if (!club || !offersSchoolPlans(club)) return false
  return memberships.some((m) => m.accountId === flight.pilotId && m.clubId === club.id && m.status === 'active')
}

/**
 * Who may confirm a simulator session: an active admin or staff CFI of the tagged school,
 * never the pilot who logged it.
 */
export function canConfirmSimSession(
  flight: Pick<Flight, 'isSimulator' | 'clubId' | 'pilotId' | 'simConfirmation'>,
  accountId: string,
  memberships: readonly Membership[],
): boolean {
  if (!flight.isSimulator || flight.clubId === null || flight.simConfirmation === null) return false
  if (accountId === flight.pilotId) return false
  return memberships.some(
    (m) =>
      m.accountId === accountId &&
      m.clubId === flight.clubId &&
      m.status === 'active' &&
      (m.roles.includes('admin') || m.roles.includes('staff_cfi')),
  )
}

const MILESTONE_BADGES: { code: string; title: string; airports: number }[] = [
  { code: 'badge:airports_5', title: 'Five airports', airports: 5 },
  { code: 'badge:airports_10', title: 'Ten airports', airports: 10 },
  { code: 'badge:airports_25', title: 'Twenty-five airports', airports: 25 },
]

/**
 * New stamps and badges a flight earns, given what the pilot already has.
 * Pure: the caller stores the result. Ids are derived from flight + code, so re-running is idempotent.
 */
export function awardForFlight(
  flight: Pick<Flight, 'id' | 'pilotId' | 'isSimulator' | 'createdAt'>,
  airportsVisited: readonly string[],
  existing: readonly Achievement[],
  airports: readonly Airport[],
): Achievement[] {
  if (!earnsStampsAndBadges(flight)) return []
  const have = new Set(existing.filter((a) => a.pilotId === flight.pilotId).map((a) => a.code))
  const out: Achievement[] = []
  const add = (a: Omit<Achievement, 'id' | 'pilotId' | 'flightId' | 'earnedAt'>) => {
    if (have.has(a.code)) return
    have.add(a.code)
    out.push({ ...a, id: `${flight.id}:${a.code}`, pilotId: flight.pilotId, flightId: flight.id, earnedAt: flight.createdAt })
  }

  add({ kind: 'badge', code: 'badge:first_flight', title: 'First flight logged', icao: null })
  for (const icao of airportsVisited) {
    const airport = airports.find((a) => a.icao === icao)
    add({ kind: 'stamp', code: `stamp:${icao}`, title: airport?.name ?? icao, icao })
  }
  const stampCount = [...have].filter((c) => c.startsWith('stamp:')).length
  for (const badge of MILESTONE_BADGES) {
    if (stampCount >= badge.airports) add({ kind: 'badge', code: badge.code, title: badge.title, icao: null })
  }
  return out
}
