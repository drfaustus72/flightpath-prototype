import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { dismissNudge, nudgesFor, sendNudge, setSponsoredSeat, sponsoredSeatCount } from './schoolOps'
import { accessContextFor, hasPilotPro } from './tiers'
import type { World } from './types'
import { checkIntegrity } from './world'

function seed(): World {
  if (!seedResult.ok) throw new Error('seed')
  return structuredClone(seedResult.world)
}
const ctx = (id = 'n1') => ({ id, now: '2026-11-13T18:00:00.000Z' })
const nudge = (pilotId: string, missionCode: string | null = 'santa_paula') => ({
  clubId: 'club-hfa',
  pilotId,
  message: 'We miss you! Santa Paula is lovely this time of year.',
  missionCode,
})

describe('nudges', () => {
  it('lets an admin or staff CFI nudge a member, once until it is dismissed', () => {
    let w = sendNudge(seed(), 'acct-alex', nudge('acct-liam'), ctx())
    expect(checkIntegrity(w)).toEqual([])
    expect(nudgesFor(w, 'acct-liam').map((n) => n.missionCode)).toEqual(['santa_paula'])
    expect(() => sendNudge(w, 'acct-dan', nudge('acct-liam'), ctx('n2'))).toThrow(/already has a note/)
    w = dismissNudge(w, 'acct-liam', 'n1', ctx())
    expect(nudgesFor(w, 'acct-liam')).toEqual([])
    w = sendNudge(w, 'acct-dan', nudge('acct-liam', null), ctx('n2'))
    expect(nudgesFor(w, 'acct-liam')).toHaveLength(1)
  })

  it('refuses members, non-members, empty or long notes and unknown missions', () => {
    const w = seed()
    expect(() => sendNudge(w, 'acct-maya', nudge('acct-liam'), ctx())).toThrow(/can’t do that/)
    expect(() => sendNudge(w, 'acct-alex', nudge('acct-jordan'), ctx())).toThrow(/isn’t a member/)
    expect(() => sendNudge(w, 'acct-alex', { ...nudge('acct-liam'), message: '  ' }, ctx())).toThrow(/short note/)
    expect(() => sendNudge(w, 'acct-alex', { ...nudge('acct-liam'), message: 'x'.repeat(281) }, ctx())).toThrow(/short note/)
    expect(() => sendNudge(w, 'acct-alex', nudge('acct-liam', 'nope'), ctx())).toThrow(/Unknown mission/)
    // Coastal is School Basic: no nudges there.
    expect(() => sendNudge(w, 'acct-kim', { ...nudge('acct-jordan'), clubId: 'club-coastal' }, ctx())).toThrow(/can’t do that/)
  })

  it('only lets the pilot dismiss their own nudge', () => {
    const w = sendNudge(seed(), 'acct-alex', nudge('acct-liam'), ctx())
    expect(() => dismissNudge(w, 'acct-maya', 'n1', ctx())).toThrow(/not found/)
  })
})

describe('sponsored seats', () => {
  it('lets a School Pro admin give a member Pilot Pro, and take it back', () => {
    const before = sponsoredSeatCount(seed(), 'club-hfa')
    let w = setSponsoredSeat(seed(), 'acct-alex', { clubId: 'club-hfa', pilotId: 'acct-lena', on: true })
    const lena = () => {
      const c = accessContextFor(w, 'acct-lena')
      if (!c) throw new Error('lena')
      return c
    }
    expect(hasPilotPro(lena())).toBe(true)
    expect(sponsoredSeatCount(w, 'club-hfa')).toBe(before + 1)
    expect(checkIntegrity(w)).toEqual([])
    w = setSponsoredSeat(w, 'acct-alex', { clubId: 'club-hfa', pilotId: 'acct-lena', on: false })
    expect(hasPilotPro(lena())).toBe(false)
  })

  it('is for admins only', () => {
    expect(() => setSponsoredSeat(seed(), 'acct-dan', { clubId: 'club-hfa', pilotId: 'acct-lena', on: true })).toThrow(/can’t do that/)
  })
})
