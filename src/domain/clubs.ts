import type { Club } from './types'

/** Flight schools and flying clubs can claim a page and subscribe (School Basic / School Pro). Community clubs can't. */
export function offersSchoolPlans(club: Club): boolean {
  return club.kind !== 'community'
}

/** Display name for a club's tier. */
export function clubPlanName(club: Club): string {
  if (!offersSchoolPlans(club)) return 'Community club'
  if (!club.claimed) return 'Unclaimed page'
  return club.plan === 'school_pro' ? 'School Pro' : 'School Basic'
}
