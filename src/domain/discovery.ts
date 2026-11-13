import { isVerifiedCfi } from './tiers'
import type { Account, Club, World } from './types'
import { effectiveLevel, followStatus, isBlocked, isDiscoverable } from './visibility'
import { followingOf } from './social'
import { homeSchoolOf } from './world'

/**
 * Discovery is anchored to airports, never to live location (brief section 3).
 *  - Discoverable pilots appear in search and suggestions.
 *  - Public pilots appear only on an exact @handle match.
 *  - Private pilots and minors never appear.
 *  - Verified CFIs who keep their directory listing on are listed as instructors whatever their
 *    personal profile level.
 *  - Blocking hides both people from each other.
 */

export interface SearchResults {
  pilots: Account[]
  cfis: Account[]
  clubs: Club[]
}

const LIMIT = 20

export function normalizeQuery(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase()
}

export function search(world: World, viewerId: string, raw: string): SearchResults {
  const q = normalizeQuery(raw)
  if (q.length < 2) return { pilots: [], cfis: [], clubs: [] }

  const has = (text: string | undefined | null) => text?.toLowerCase().includes(q) ?? false
  const matches = (a: Account) =>
    has(a.displayName) || has(a.handle) || a.homeAirport.toLowerCase() === q || has(homeSchoolOf(world, a.id)?.name)

  const visible = world.accounts.filter((a) => a.id !== viewerId && !a.isMinor && !isBlocked(world, viewerId, a.id))

  // Unlisted CFIs are found only the way any pilot is: by their own profile level.
  const cfis = visible.filter((a) => isVerifiedCfi(a) && a.cfi?.listed === true && matches(a))
  const cfiIds = new Set(cfis.map((a) => a.id))
  const pilots = visible.filter(
    (a) =>
      !cfiIds.has(a.id) &&
      ((isDiscoverable(a) && matches(a)) || (effectiveLevel(a) === 'public' && a.handle === q)),
  )
  const clubs = world.clubs.filter((c) => has(c.name) || c.homeAirport.toLowerCase() === q || c.initials.toLowerCase() === q)

  return { pilots: pilots.slice(0, LIMIT), cfis: cfis.slice(0, LIMIT), clubs: clubs.slice(0, LIMIT) }
}

export interface Suggestion {
  account: Account
  reasons: string[]
}

/**
 * "Pilots you may know": Discoverable adults only, never minors, never someone you follow
 * or have asked to follow, never across a block. Ranked by shared context.
 */
export function suggestionsFor(world: World, viewerId: string, limit = 6): Suggestion[] {
  const viewer = world.accounts.find((a) => a.id === viewerId)
  if (!viewer) return []

  const myClubs = new Map(
    world.memberships
      .filter((m) => m.accountId === viewerId && m.status === 'active')
      .flatMap((m) => {
        const c = world.clubs.find((x) => x.id === m.clubId)
        return c ? [[c.id, c] as const] : []
      }),
  )
  const following = followingOf(world, viewerId)
  const flewWithMe = new Set(
    world.flights.flatMap((f) => {
      const tagged = f.flewWith.filter((t) => t.status === 'accepted').map((t) => t.accountId)
      if (f.pilotId === viewerId) return tagged
      return tagged.includes(viewerId) ? [f.pilotId] : []
    }),
  )

  const scored = world.accounts.flatMap((a) => {
    if (a.id === viewerId || !isDiscoverable(a) || isBlocked(world, viewerId, a.id)) return []
    if (followStatus(world, viewerId, a.id) !== 'none') return []

    let score = 0
    const reasons: string[] = []
    if (flewWithMe.has(a.id)) {
      score += 3
      reasons.push('Flew with you')
    }
    const shared = world.memberships.find((m) => m.accountId === a.id && m.status === 'active' && myClubs.has(m.clubId))
    const sharedClub = shared ? myClubs.get(shared.clubId) : undefined
    if (sharedClub) {
      score += 3
      reasons.push(`Also at ${sharedClub.name}`)
    }
    if (a.homeAirport === viewer.homeAirport) {
      score += 2
      reasons.push(`Based at ${a.homeAirport}`)
    }
    const via = following.filter((f) => followStatus(world, f.id, a.id) === 'accepted')
    if (via[0]) {
      score += via.length
      reasons.push(via.length === 1 ? `Followed by ${via[0].displayName}` : `Followed by ${via[0].displayName} and ${via.length - 1} more`)
    }
    return score > 0 ? [{ account: a, reasons, score }] : []
  })

  return scored
    .sort((x, y) => y.score - x.score || x.account.displayName.localeCompare(y.account.displayName))
    .slice(0, limit)
    .map(({ account, reasons }) => ({ account, reasons }))
}
