import { describe, expect, it } from 'vitest'
import { makeAccount, makeCfi, makeClub, makeMembership } from '../test/factories'
import {
  ACCOUNT_FEATURES,
  type AccessContext,
  type AccountFeature,
  can,
  canInClub,
  hasCfiPro,
  hasPilotPro,
  planLabels,
} from './tiers'

const ctx = (partial: Partial<AccessContext> & Pick<AccessContext, 'account'>): AccessContext => ({
  clubs: [],
  memberships: [],
  ...partial,
})

const featuresWith = (req: string) =>
  (Object.keys(ACCOUNT_FEATURES) as AccountFeature[]).filter((f) => ACCOUNT_FEATURES[f] === req)

describe('pilot tiers', () => {
  it('gives every account the free features and nothing paid', () => {
    const c = ctx({ account: makeAccount() })
    for (const f of featuresWith('pilot_free')) expect(can(c, f)).toBe(true)
    for (const f of featuresWith('pilot_pro')) expect(can(c, f)).toBe(false)
    for (const f of featuresWith('cfi')) expect(can(c, f)).toBe(false)
  })

  it('unlocks Pilot Pro features for a paying pilot', () => {
    const c = ctx({ account: makeAccount({ subscription: { pilotPro: true, cfiPro: false } }) })
    for (const f of featuresWith('pilot_pro')) expect(can(c, f)).toBe(true)
  })

  it('unlocks Pilot Pro through a sponsored seat at a School Pro school', () => {
    const c = ctx({
      account: makeAccount(),
      clubs: [makeClub({ plan: 'school_pro' })],
      memberships: [makeMembership({ sponsoredPilotPro: true })],
    })
    expect(hasPilotPro(c)).toBe(true)
  })

  it('ignores a sponsored seat if the school is School Basic or the membership ended', () => {
    expect(
      hasPilotPro(
        ctx({
          account: makeAccount(),
          clubs: [makeClub({ plan: 'school_basic' })],
          memberships: [makeMembership({ sponsoredPilotPro: true })],
        }),
      ),
    ).toBe(false)
    expect(
      hasPilotPro(
        ctx({
          account: makeAccount(),
          clubs: [makeClub()],
          memberships: [makeMembership({ sponsoredPilotPro: true, status: 'former' })],
        }),
      ),
    ).toBe(false)
  })
})

describe('CFI tiers', () => {
  it('never paywalls sign-off authority: a verified CFI with no subscriptions can sign off', () => {
    const c = ctx({ account: makeCfi() })
    for (const f of featuresWith('cfi')) expect(can(c, f)).toBe(true)
    expect(can(c, 'cfi.signOff')).toBe(true)
    for (const f of featuresWith('cfi_pro')) expect(can(c, f)).toBe(false)
  })

  it('gives an unverified CFI no CFI features, even if paying for CFI Pro', () => {
    const c = ctx({
      account: makeCfi({
        cfi: { verified: false, ratings: ['CFI'], independent: true },
        subscription: { pilotPro: false, cfiPro: true },
      }),
    })
    expect(can(c, 'cfi.signOff')).toBe(false)
    expect(hasCfiPro(c)).toBe(false)
  })

  it('includes all Pilot Pro features in CFI Pro', () => {
    const c = ctx({ account: makeCfi({ subscription: { pilotPro: false, cfiPro: true } }) })
    for (const f of featuresWith('cfi_pro')) expect(can(c, f)).toBe(true)
    for (const f of featuresWith('pilot_pro')) expect(can(c, f)).toBe(true)
  })

  it('includes CFI Pro for staff CFIs of a School Pro school, but not School Basic', () => {
    const staff = makeMembership({ accountId: 'acct-cfi', roles: ['staff_cfi'] })
    expect(
      hasCfiPro(ctx({ account: makeCfi(), clubs: [makeClub({ plan: 'school_pro' })], memberships: [staff] })),
    ).toBe(true)
    expect(
      hasCfiPro(ctx({ account: makeCfi(), clubs: [makeClub({ plan: 'school_basic' })], memberships: [staff] })),
    ).toBe(false)
  })
})

describe('school tiers', () => {
  const admin = makeMembership({ roles: ['admin'] })

  it('lets a School Basic admin edit the page but not use any Pro service', () => {
    const c = ctx({ account: makeAccount(), clubs: [makeClub({ plan: 'school_basic' })], memberships: [admin] })
    expect(canInClub(c, 'school.editPage', 'club-test')).toBe(true)
    expect(canInClub(c, 'school.feed', 'club-test')).toBe(false)
    expect(canInClub(c, 'school.dashboard', 'club-test')).toBe(false)
    expect(canInClub(c, 'school.perks', 'club-test')).toBe(false)
  })

  it('lets a School Pro admin use Pro services', () => {
    const c = ctx({ account: makeAccount(), clubs: [makeClub()], memberships: [admin] })
    expect(canInClub(c, 'school.dashboard', 'club-test')).toBe(true)
    expect(canInClub(c, 'school.brandedPosts', 'club-test')).toBe(true)
  })

  it('treats a flying club on School Pro like a school', () => {
    const c = ctx({ account: makeAccount(), clubs: [makeClub({ kind: 'flying_club' })], memberships: [admin] })
    expect(canInClub(c, 'school.dashboard', 'club-test')).toBe(true)
  })

  it('gives community clubs no school tools', () => {
    const c = ctx({
      account: makeAccount(),
      clubs: [makeClub({ kind: 'community', plan: 'community' })],
      memberships: [admin],
    })
    expect(canInClub(c, 'school.editPage', 'club-test')).toBe(false)
  })

  it('denies non-admins, other clubs, unclaimed pages and unknown clubs', () => {
    const member = ctx({ account: makeAccount(), clubs: [makeClub()], memberships: [makeMembership()] })
    expect(canInClub(member, 'school.editPage', 'club-test')).toBe(false)

    const adminElsewhere = ctx({ account: makeAccount(), clubs: [makeClub(), makeClub({ id: 'club-b' })], memberships: [admin] })
    expect(canInClub(adminElsewhere, 'school.dashboard', 'club-b')).toBe(false)

    const unclaimed = ctx({ account: makeAccount(), clubs: [makeClub({ claimed: false })], memberships: [admin] })
    expect(canInClub(unclaimed, 'school.editPage', 'club-test')).toBe(false)

    expect(canInClub(member, 'school.editPage', 'nope')).toBe(false)
  })
})

describe('planLabels', () => {
  it('labels free pilots, Pro pilots, verified CFIs and CFI Pro', () => {
    expect(planLabels(ctx({ account: makeAccount() }))).toEqual(['Pilot Free'])
    expect(planLabels(ctx({ account: makeCfi() }))).toEqual(['Pilot Free', 'Verified CFI'])
    expect(planLabels(ctx({ account: makeCfi({ subscription: { pilotPro: false, cfiPro: true } }) }))).toEqual([
      'Pilot Pro',
      'CFI Pro',
    ])
  })
})
