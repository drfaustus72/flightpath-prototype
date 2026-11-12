import { offersSchoolPlans } from './clubs'
import type { Account, Club, Membership, World } from './types'

/**
 * The single tier gating map. Every gated feature is listed here exactly once.
 * Components must call `can` / `canInClub`; never compare plan names in UI code.
 *
 * Account requirements:
 *  - pilot_free: any account
 *  - pilot_pro:  Pilot Pro (paid, school-sponsored seat, or via CFI Pro)
 *  - cfi:        verified CFI role (free — sign-off authority is never paywalled)
 *  - cfi_pro:    verified CFI with CFI Pro (paid, or staff CFI at a School Pro school)
 *  - school_pro_member: active member of a School Pro school. XP is school-bound: it is earned
 *    and held at that school and comes with the School Pro account, not with Pilot Pro.
 *
 * Club requirements (the account must be an active admin of that club):
 *  - school_admin:     any flight school page (School Basic or Pro)
 *  - school_pro_admin: School Pro only
 */
export const ACCOUNT_FEATURES = {
  'flight.log': 'pilot_free',
  'social.follow': 'pilot_free',
  'social.props': 'pilot_free',
  'social.comment': 'pilot_free',
  'achievements.stamps': 'pilot_free',
  'achievements.basicBadges': 'pilot_free',
  'media.basicCard': 'pilot_free',
  'clubs.join': 'pilot_free',

  'progress.xp': 'school_pro_member',
  'progress.ranks': 'school_pro_member',
  'progress.pathways': 'pilot_pro',
  'progress.advisor': 'pilot_pro',
  'progress.challenges': 'pilot_pro',
  'media.polishedCard': 'pilot_pro',
  'stats.advanced': 'pilot_pro',

  'cfi.tagging': 'cfi',
  'cfi.debrief': 'cfi',
  'cfi.signOff': 'cfi',
  'cfi.linkStudents': 'cfi',

  'cfi.roster': 'cfi_pro',
  'cfi.assignMissions': 'cfi_pro',
  'cfi.templates': 'cfi_pro',
  'cfi.listing': 'cfi_pro',
} as const satisfies Record<string, AccountRequirement>

export const CLUB_FEATURES = {
  'school.editPage': 'school_admin',
  'school.approveMembers': 'school_admin',
  'school.confirmStaffCfis': 'school_admin',

  'school.feed': 'school_pro_admin',
  'school.dashboard': 'school_pro_admin',
  'school.brandedPosts': 'school_pro_admin',
  'school.repostRequests': 'school_pro_admin',
  'school.missionWall': 'school_pro_admin',
  'school.customChallenges': 'school_pro_admin',
  'school.perks': 'school_pro_admin',
  'school.sponsorSeats': 'school_pro_admin',
} as const satisfies Record<string, ClubRequirement>

export type AccountRequirement = 'pilot_free' | 'pilot_pro' | 'cfi' | 'cfi_pro' | 'school_pro_member'
export type ClubRequirement = 'school_admin' | 'school_pro_admin'
export type AccountFeature = keyof typeof ACCOUNT_FEATURES
export type ClubFeature = keyof typeof CLUB_FEATURES

/** What gating needs to know: the account plus the clubs and memberships it can see. */
export interface AccessContext {
  account: Account
  clubs: readonly Club[]
  memberships: readonly Membership[]
}

export function accessContextFor(world: World, accountId: string): AccessContext | null {
  const account = world.accounts.find((a) => a.id === accountId)
  if (!account) return null
  return { account, clubs: world.clubs, memberships: world.memberships }
}

function activeMembershipsOf(ctx: AccessContext): Membership[] {
  return ctx.memberships.filter((m) => m.accountId === ctx.account.id && m.status === 'active')
}

function clubById(ctx: AccessContext, clubId: string): Club | undefined {
  return ctx.clubs.find((c) => c.id === clubId)
}

export function isVerifiedCfi(account: Account): boolean {
  return account.cfi?.verified === true
}

/** CFI Pro: paid by the CFI, or included as staff CFI of an active School Pro school. */
export function hasCfiPro(ctx: AccessContext): boolean {
  if (!isVerifiedCfi(ctx.account)) return false
  if (ctx.account.subscription.cfiPro) return true
  return activeMembershipsOf(ctx).some(
    (m) => m.roles.includes('staff_cfi') && clubById(ctx, m.clubId)?.plan === 'school_pro',
  )
}

/** Pilot Pro: paid, sponsored by an active School Pro school, or included in CFI Pro. */
export function hasPilotPro(ctx: AccessContext): boolean {
  if (ctx.account.subscription.pilotPro) return true
  if (hasCfiPro(ctx)) return true
  return activeMembershipsOf(ctx).some(
    (m) => m.sponsoredPilotPro && clubById(ctx, m.clubId)?.plan === 'school_pro',
  )
}

export function can(ctx: AccessContext, feature: AccountFeature): boolean {
  const requirement: AccountRequirement = ACCOUNT_FEATURES[feature]
  switch (requirement) {
    case 'pilot_free':
      return true
    case 'pilot_pro':
      return hasPilotPro(ctx)
    case 'cfi':
      return isVerifiedCfi(ctx.account)
    case 'cfi_pro':
      return hasCfiPro(ctx)
    case 'school_pro_member':
      return xpSchoolsOf(ctx).length > 0
  }
}

/** School Pro schools where this account earns and holds XP. */
export function xpSchoolsOf(ctx: AccessContext): Club[] {
  const ids = new Set(activeMembershipsOf(ctx).map((m) => m.clubId))
  return ctx.clubs.filter((c) => ids.has(c.id) && c.plan === 'school_pro' && c.claimed)
}

export function canInClub(ctx: AccessContext, feature: ClubFeature, clubId: string): boolean {
  const club = clubById(ctx, clubId)
  if (!club || !offersSchoolPlans(club) || !club.claimed) return false
  const isAdmin = activeMembershipsOf(ctx).some((m) => m.clubId === clubId && m.roles.includes('admin'))
  if (!isAdmin) return false
  const requirement: ClubRequirement = CLUB_FEATURES[feature]
  switch (requirement) {
    case 'school_admin':
      return true
    case 'school_pro_admin':
      return club.plan === 'school_pro'
  }
}

/** Plan badges to show on a profile or settings screen. */
export function planLabels(ctx: AccessContext): string[] {
  const labels: string[] = [hasPilotPro(ctx) ? 'Pilot Pro' : 'Pilot Free']
  if (isVerifiedCfi(ctx.account)) labels.push(hasCfiPro(ctx) ? 'CFI Pro' : 'Verified CFI')
  return labels
}
