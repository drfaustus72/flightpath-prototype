import { COMMENT_MAX } from './schemas'
import type { Account, Club, Comment, Flight, Follow, Tag, World } from './types'
import { canSeeField, canViewFlight, effectiveLevel, followStatus, isBlocked } from './visibility'

/** Follows, Props, comments, tags and feeds. Pure functions over the world. */

const byNewest = (a: Flight, b: Flight) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt)

export function accountById(world: World, id: string): Account | undefined {
  return world.accounts.find((a) => a.id === id)
}

function accountsByIds(world: World, ids: readonly string[]): Account[] {
  return ids.flatMap((id) => accountById(world, id) ?? [])
}

export function followersOf(world: World, accountId: string): Account[] {
  return accountsByIds(world, world.follows.filter((f) => f.followeeId === accountId && f.status === 'accepted').map((f) => f.followerId))
}

export function followingOf(world: World, accountId: string): Account[] {
  return accountsByIds(world, world.follows.filter((f) => f.followerId === accountId && f.status === 'accepted').map((f) => f.followeeId))
}

/** Follow requests waiting for the owner of a Private profile. */
export function pendingFollowRequests(world: World, ownerId: string): Follow[] {
  return world.follows.filter((f) => f.followeeId === ownerId && f.status === 'pending' && !isBlocked(world, f.followerId, ownerId))
}

export function canFollow(world: World, followerId: string, followeeId: string): boolean {
  if (followerId === followeeId || !accountById(world, followeeId)) return false
  if (isBlocked(world, followerId, followeeId)) return false
  return followStatus(world, followerId, followeeId) === 'none'
}

/** Following a Private profile (and every minor's) needs approval; Public and Discoverable are open. */
export function initialFollowStatus(followee: Account): Follow['status'] {
  return effectiveLevel(followee) === 'private' ? 'pending' : 'accepted'
}

export function propsCount(world: World, flightId: string): number {
  return world.props.filter((p) => p.flightId === flightId).length
}

export function hasGivenProps(world: World, accountId: string, flightId: string): boolean {
  return world.props.some((p) => p.flightId === flightId && p.accountId === accountId)
}

/** Props and comments need a flight you can see; you can't give Props to your own flight. */
export function canGiveProps(world: World, accountId: string, flight: Flight): boolean {
  return accountId !== flight.pilotId && canViewFlight(world, flight, accountId)
}

export function canComment(world: World, accountId: string, flight: Flight): boolean {
  return canViewFlight(world, flight, accountId)
}

export type CommentCheck = { ok: true; text: string } | { ok: false; error: string }

export function checkCommentText(raw: string): CommentCheck {
  const text = raw.trim()
  if (text.length === 0) return { ok: false, error: 'Write something before posting.' }
  if (text.length > COMMENT_MAX) return { ok: false, error: `Comments can be up to ${COMMENT_MAX} characters.` }
  return { ok: true, text }
}

/** Comments a viewer sees on a flight: hides authors either side has blocked. Oldest first. */
export function commentsFor(world: World, viewerId: string, flightId: string): Comment[] {
  return world.comments
    .filter((c) => c.flightId === flightId && !isBlocked(world, viewerId, c.authorId))
    .sort((a, b) => a.at.localeCompare(b.at))
}

/** Tags that show publicly: only ones the tagged person accepted. */
export function acceptedTags(tags: readonly Tag[]): Tag[] {
  return tags.filter((t) => t.status === 'accepted')
}

/** "Flew with" tags waiting for this account's answer. */
export function pendingFlewWithTags(world: World, accountId: string): Flight[] {
  return world.flights.filter((f) => f.flewWith.some((t) => t.accountId === accountId && t.status === 'pending'))
}

/** Clubs whose feed the account can read: School Pro schools and community clubs (School Basic has no feed). */
export function feedClubsOf(world: World, accountId: string): Club[] {
  const ids = new Set(world.memberships.filter((m) => m.accountId === accountId && m.status === 'active').map((m) => m.clubId))
  return world.clubs.filter((c) => ids.has(c.id) && (c.plan === 'school_pro' || c.plan === 'community'))
}

export type FeedScope = 'following' | 'clubs'

/**
 * Following: your flights, flights from people you follow, and flights you were tagged on and accepted.
 * Clubs: flights tagged to clubs with a feed you belong to. Both newest first.
 */
export function feedFor(world: World, viewerId: string, scope: FeedScope = 'following'): Flight[] {
  let include: (f: Flight) => boolean
  if (scope === 'following') {
    const following = new Set(followingOf(world, viewerId).map((a) => a.id))
    include = (f) =>
      f.pilotId === viewerId ||
      following.has(f.pilotId) ||
      [...(f.instructor ? [f.instructor] : []), ...f.flewWith].some((t) => t.accountId === viewerId && t.status === 'accepted')
  } else {
    const clubs = new Set(feedClubsOf(world, viewerId).map((c) => c.id))
    include = (f) => f.clubId !== null && clubs.has(f.clubId)
  }
  return world.flights.filter((f) => include(f) && canViewFlight(world, f, viewerId)).sort(byNewest)
}

/** Flights shown on a profile to this viewer, newest first. Follows the owner's "activity" setting. */
export function profileFlights(world: World, viewerId: string, ownerId: string): Flight[] {
  const owner = accountById(world, ownerId)
  if (!owner || !canSeeField(world, viewerId, owner, 'activity')) return []
  return world.flights.filter((f) => f.pilotId === ownerId && canViewFlight(world, f, viewerId)).sort(byNewest)
}
