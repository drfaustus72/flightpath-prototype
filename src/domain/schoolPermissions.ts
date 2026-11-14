import type { ClubFeature } from './tiers'
import type { Membership } from './types'

export type SchoolRole = 'admin' | 'staff_cfi'

/**
 * Who on a school's staff may use each school feature. Plans are gated separately in
 * `tiers.ts` (CLUB_FEATURES); a feature is open only when the plan and the role both allow it.
 *
 * Staff CFIs work the school's queue (verify missions, confirm simulator sessions), see members,
 * nudge them and read the dashboard. The page, membership decisions, outward-facing content,
 * challenges and paid seats stay with admins.
 */
export const SCHOOL_ROLE_PERMISSIONS = {
  'school.editPage': ['admin'],
  'school.approveMembers': ['admin'],
  'school.confirmStaffCfis': ['admin'],

  'school.queue': ['admin', 'staff_cfi'],
  'school.members': ['admin', 'staff_cfi'],
  'school.nudges': ['admin', 'staff_cfi'],
  'school.dashboard': ['admin', 'staff_cfi'],

  'school.feed': ['admin'],
  'school.brandedPosts': ['admin'],
  'school.repostRequests': ['admin'],
  'school.missionWall': ['admin'],
  'school.customChallenges': ['admin'],
  'school.perks': ['admin'],
  'school.sponsorSeats': ['admin'],
} as const satisfies Record<ClubFeature, readonly SchoolRole[]>

/** The staff roles this membership holds (active memberships only). */
export function schoolRolesOf(membership: Pick<Membership, 'roles' | 'status'> | undefined): SchoolRole[] {
  if (!membership || membership.status !== 'active') return []
  return membership.roles.filter((r): r is SchoolRole => r === 'admin' || r === 'staff_cfi')
}

export function roleAllows(roles: readonly SchoolRole[], feature: ClubFeature): boolean {
  const allowed: readonly SchoolRole[] = SCHOOL_ROLE_PERMISSIONS[feature]
  return roles.some((r) => allowed.includes(r))
}
