import type { Flight, Membership } from './types'

/**
 * XP rule (decided 12 Nov 2026): XP comes only from missions and achievements, and the
 * pilot's flight school must verify each one. A logged flight earns no XP by itself.
 * A simulator session can count toward a mission or achievement once the school confirms it.
 */

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
