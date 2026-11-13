import type { Account, Flight, ProfileField, Visibility, World } from './types'

/**
 * Who can see what. Every screen asks these functions; none decides visibility on its own.
 *
 * Profile level (Private / Public / Discoverable) decides who can open a profile at all.
 * Per-field settings then narrow what each viewer sees. Minors are always Private.
 */

/** Product defaults from the brief (section 5) for fields an account hasn't set. */
export const FIELD_DEFAULTS: Record<ProfileField, Visibility> = {
  homeAirport: 'public',
  certificates: 'public',
  totalHours: 'followers',
  homeSchool: 'public',
  achievements: 'public',
  activity: 'followers',
  airportMap: 'public',
}

export function fieldVisibility(account: Account, field: ProfileField): Visibility {
  const v = account.visibility[field] ?? FIELD_DEFAULTS[field]
  // A minor's fields are never public, whatever is stored.
  return account.isMinor && v === 'public' ? 'followers' : v
}

/** A minor's profile is Private regardless of the stored level. */
export function effectiveLevel(account: Account): Account['profileLevel'] {
  return account.isMinor ? 'private' : account.profileLevel
}

export function isDiscoverable(account: Account): boolean {
  return effectiveLevel(account) === 'discoverable'
}

/** True when either account has blocked the other. Blocking hides both from each other. */
export function isBlocked(world: World, a: string, b: string): boolean {
  return world.blocks.some((x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a))
}

export function followStatus(world: World, followerId: string, followeeId: string): 'none' | 'pending' | 'accepted' {
  return world.follows.find((f) => f.followerId === followerId && f.followeeId === followeeId)?.status ?? 'none'
}

export function isFollowing(world: World, followerId: string, followeeId: string): boolean {
  return followStatus(world, followerId, followeeId) === 'accepted'
}

function activeClubIds(world: World, accountId: string): Set<string> {
  return new Set(world.memberships.filter((m) => m.accountId === accountId && m.status === 'active').map((m) => m.clubId))
}

export function sharesClub(world: World, a: string, b: string): boolean {
  const mine = activeClubIds(world, a)
  return [...activeClubIds(world, b)].some((id) => mine.has(id))
}

/** An active CFI–student link. */
export function isInstructorOf(world: World, cfiId: string, studentId: string): boolean {
  return world.cfiLinks.some((l) => l.cfiId === cfiId && l.studentId === studentId && l.status === 'active')
}

/** Admins and staff CFIs of a club the account belongs to (for training data they're entitled to). */
function isClubStaffOf(world: World, staffId: string, memberId: string): boolean {
  return [...activeClubIds(world, memberId)].some((clubId) => isStaffOfClub(world, staffId, clubId))
}

export function canSeeProfile(world: World, viewerId: string, ownerId: string): boolean {
  if (viewerId === ownerId) return true
  const owner = world.accounts.find((a) => a.id === ownerId)
  if (!owner || isBlocked(world, viewerId, ownerId)) return false
  if (effectiveLevel(owner) !== 'private') return true
  return isFollowing(world, viewerId, ownerId) || isInstructorOf(world, viewerId, ownerId) || isClubStaffOf(world, viewerId, ownerId)
}

export function canSeeField(world: World, viewerId: string, owner: Account, field: ProfileField): boolean {
  if (viewerId === owner.id) return true
  if (!canSeeProfile(world, viewerId, owner.id)) return false
  switch (fieldVisibility(owner, field)) {
    case 'public':
      return true
    case 'followers':
      return isFollowing(world, viewerId, owner.id)
    case 'club':
      return sharesClub(world, viewerId, owner.id)
    case 'private':
      return false
  }
}

/**
 * Whether a viewer may see a flight. Besides the post's own audience:
 *  - people tagged on it (instructor, flew with) see it, so they can accept, decline or debrief;
 *  - admins and staff CFIs of the club it's tagged to see it: tagging a flight to a school shares it
 *    with that school (schools see only flights logged under their club).
 */
export function canViewFlight(world: World, flight: Flight, viewerId: string): boolean {
  if (viewerId === flight.pilotId) return true
  const pilot = world.accounts.find((a) => a.id === flight.pilotId)
  if (!pilot || isBlocked(world, viewerId, pilot.id)) return false

  const tags = [...(flight.instructor ? [flight.instructor] : []), ...flight.flewWith]
  if (tags.some((t) => t.accountId === viewerId && t.status !== 'declined')) return true
  if (flight.clubId !== null && isStaffOfClub(world, viewerId, flight.clubId)) return true

  if (flight.postVisibility === 'private') return false
  if (!canSeeProfile(world, viewerId, pilot.id)) return false
  return flight.postVisibility === 'public' || isFollowing(world, viewerId, pilot.id)
}

export function isStaffOfClub(world: World, accountId: string, clubId: string): boolean {
  return world.memberships.some(
    (m) =>
      m.accountId === accountId &&
      m.clubId === clubId &&
      m.status === 'active' &&
      (m.roles.includes('admin') || m.roles.includes('staff_cfi')),
  )
}
