import { describe, expect, it } from 'vitest'
import { makeAccount, makeClub, makeMembership } from '../test/factories'
import { SCHOOL_ROLE_PERMISSIONS, roleAllows, schoolRolesOf } from './schoolPermissions'
import { CLUB_FEATURES, type ClubFeature, canInClub } from './tiers'

const ctx = (roles: ('admin' | 'staff_cfi' | 'member')[], plan: 'school_pro' | 'school_basic' = 'school_pro') => ({
  account: makeAccount(),
  clubs: [makeClub({ plan })],
  memberships: [makeMembership({ roles })],
})

describe('school role permissions', () => {
  it('lists a role rule for every club feature', () => {
    expect(Object.keys(SCHOOL_ROLE_PERMISSIONS).sort()).toEqual(Object.keys(CLUB_FEATURES).sort())
  })

  it('gives admins every feature their plan includes', () => {
    for (const f of Object.keys(CLUB_FEATURES) as ClubFeature[]) {
      expect(canInClub(ctx(['admin']), f, 'club-test')).toBe(true)
    }
  })

  it('lets staff CFIs work the queue, see members, nudge and read the dashboard, and nothing else', () => {
    const staff = ctx(['staff_cfi'])
    const open = (Object.keys(CLUB_FEATURES) as ClubFeature[]).filter((f) => canInClub(staff, f, 'club-test'))
    expect(open.sort()).toEqual(['school.dashboard', 'school.members', 'school.nudges', 'school.queue'])
  })

  it('still needs the plan: a School Basic staff CFI gets the queue only', () => {
    const staff = ctx(['staff_cfi'], 'school_basic')
    const open = (Object.keys(CLUB_FEATURES) as ClubFeature[]).filter((f) => canInClub(staff, f, 'club-test'))
    expect(open).toEqual(['school.queue'])
  })

  it('gives plain members and former staff nothing', () => {
    expect(canInClub(ctx(['member']), 'school.queue', 'club-test')).toBe(false)
    expect(schoolRolesOf(makeMembership({ roles: ['admin'], status: 'former' }))).toEqual([])
    expect(schoolRolesOf(undefined)).toEqual([])
  })

  it('combines roles held together', () => {
    expect(roleAllows(['staff_cfi', 'admin'], 'school.sponsorSeats')).toBe(true)
    expect(roleAllows(['staff_cfi'], 'school.sponsorSeats')).toBe(false)
  })
})
