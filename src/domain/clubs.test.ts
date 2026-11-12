import { describe, expect, it } from 'vitest'
import { makeClub } from '../test/factories'
import { clubPlanName, offersSchoolPlans } from './clubs'

describe('clubs', () => {
  it('lets flight schools and flying clubs subscribe, not community clubs', () => {
    expect(offersSchoolPlans(makeClub({ kind: 'flight_school' }))).toBe(true)
    expect(offersSchoolPlans(makeClub({ kind: 'flying_club' }))).toBe(true)
    expect(offersSchoolPlans(makeClub({ kind: 'community', plan: 'community' }))).toBe(false)
  })

  it('names each tier', () => {
    expect(clubPlanName(makeClub())).toBe('School Pro')
    expect(clubPlanName(makeClub({ plan: 'school_basic' }))).toBe('School Basic')
    expect(clubPlanName(makeClub({ claimed: false }))).toBe('Unclaimed page')
    expect(clubPlanName(makeClub({ kind: 'community', plan: 'community' }))).toBe('Community club')
  })
})
