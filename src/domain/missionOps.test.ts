import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { flyLegs, outAndBack } from '../test/flights'
import * as ops from './missionOps'
import { checkIntegrity } from './world'
import type { World } from './types'
import { xpSummary } from './xp'
import { missionByCode, missionStatus, missionsToVerify } from './missions'
import type { Mission } from './types'

const santaPaula = (w: World): Mission => {
  const m = missionByCode(w, 'santa_paula')
  if (!m) throw new Error('santa_paula missing')
  return m
}

let n = 0
const ctx = () => ({ id: `mop-${++n}`, now: '2026-11-14T20:00:00.000Z' })
function seed(): World {
  if (!seedResult.ok) throw new Error('seed')
  return structuredClone(seedResult.world)
}

describe('Script A: Maya flies to Catalina and the school verifies it', () => {
  it('earns XP at Hawthorne Flight Academy once Dan verifies, and loses it on revocation', () => {
    let w = seed()
    const f = flyLegs(w, outAndBack('KHHR', 'KAVX'), '2026-11-14T17:00:00Z', { pilotId: 'acct-maya', clubId: 'club-hfa' })
    w.flights.push(f)
    expect(() => ops.verifyMission(w, 'acct-maya', f.id, 'airport_in_the_sky', ctx())).toThrow()
    w = ops.verifyMission(w, 'acct-dan', f.id, 'airport_in_the_sky', ctx())
    expect(checkIntegrity(w)).toEqual([])
    expect(xpSummary(w, 'acct-maya')[0]?.xp).toBe(200)

    const v = w.missionVerifications.at(-1)
    if (!v) throw new Error('missing verification')
    expect(v.clubId).toBe('club-hfa')
    expect(ops.canRevokeMissionVerification(w, 'acct-alex', v.id)).toBe(true) // school admin
    expect(ops.canRevokeMissionVerification(w, 'acct-maya', v.id)).toBe(false)
    expect(() => ops.revokeMissionVerification(w, 'acct-dan', v.id, ' ', ctx())).toThrow('reason')
    w = ops.revokeMissionVerification(w, 'acct-dan', v.id, 'Landed at the wrong airport', ctx())
    expect(xpSummary(w, 'acct-maya')[0]?.xp).toBe(0)
  })
})

describe('self-reported missions', () => {
  it('shows as self-reported, earns nothing alone, and earns XP once the school verifies it', () => {
    let w = seed()
    w = ops.claimMission(w, 'acct-lena', 'santa_paula', ctx())
    expect(missionStatus(w, 'acct-lena', santaPaula(w)).source).toBe('self_reported')
    expect(xpSummary(w, 'acct-lena')[0]?.xp).toBe(300) // only the seed's verified coastal cross-country

    expect(missionsToVerify(w, 'acct-alex').some((x) => x.kind === 'self_reported' && x.pilotId === 'acct-lena')).toBe(true)
    expect(() => ops.verifyMissionClaim(w, 'acct-lena', 'acct-lena', 'santa_paula', 'club-hfa', true, ctx())).toThrow()
    expect(() => ops.verifyMissionClaim(w, 'acct-kim', 'acct-lena', 'santa_paula', 'club-hfa', true, ctx())).toThrow()
    w = ops.verifyMissionClaim(w, 'acct-alex', 'acct-lena', 'santa_paula', 'club-hfa', true, ctx())
    expect(checkIntegrity(w)).toEqual([])
    expect(missionStatus(w, 'acct-lena', santaPaula(w)).source).toBe('verified')
    expect(xpSummary(w, 'acct-lena')[0]?.xp).toBe(450)
  })

  it("doesn't let a School Basic school verify for XP", () => {
    const w = seed()
    // Jordan's seed claim (Santa Paula) belongs to a School Basic member: no one can verify it for XP.
    expect(missionsToVerify(w, 'acct-kim').filter((x) => x.pilotId === 'acct-jordan')).toEqual([])
  })
})

describe('challenges and no-gos', () => {
  it('joins once, leaves, and records a no-go with a reason', () => {
    let w = seed()
    w = ops.joinChallenge(w, 'acct-jordan', 'good_call', ctx())
    w = ops.joinChallenge(w, 'acct-jordan', 'good_call', ctx())
    expect(w.challengeEntries.filter((e) => e.pilotId === 'acct-jordan')).toHaveLength(1)
    expect(() => ops.recordNoGo(w, 'acct-jordan', { from: 'KCMA', to: null, reason: '  ' }, ctx())).toThrow()
    w = ops.recordNoGo(w, 'acct-jordan', { from: 'KCMA', to: 'KSZP', reason: 'Gusts 25 kt across the runway' }, ctx())
    expect(checkIntegrity(w)).toEqual([])
    w = ops.leaveChallenge(w, 'acct-jordan', 'good_call')
    expect(w.challengeEntries.some((e) => e.pilotId === 'acct-jordan')).toBe(false)
  })
})
