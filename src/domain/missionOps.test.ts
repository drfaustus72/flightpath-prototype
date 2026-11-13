import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { flyLegs, outAndBack } from '../test/flights'
import * as ops from './missionOps'
import { checkIntegrity } from './world'
import type { World } from './types'
import { xpSummary } from './xp'

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
