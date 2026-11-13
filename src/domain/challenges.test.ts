import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { flyLegs, outAndBack } from '../test/flights'
import { challengeProgress } from './challenges'
import type { Challenge, World } from './types'

function seed(): World {
  if (!seedResult.ok) throw new Error('seed')
  return structuredClone(seedResult.world)
}
const challenge = (w: World, code: string): Challenge => {
  const c = w.challenges.find((x) => x.code === code)
  if (!c) throw new Error(code)
  return c
}

describe('challengeProgress', () => {
  it('counts only airports first visited after joining', () => {
    const w = seed()
    const c = challenge(w, 'five_new_airports')
    // Maya's seed flights (KHHR, KCMA) came after 1 Oct; joining later leaves them out.
    expect(challengeProgress(w, 'acct-maya', c, '2026-10-01T00:00:00Z').items.sort()).toEqual(['KCMA', 'KHHR'])
    expect(challengeProgress(w, 'acct-maya', c, '2026-11-13T00:00:00Z').current).toBe(0)
    w.flights.push(flyLegs(w, outAndBack('KHHR', 'KAVX'), '2026-11-14T17:00:00Z', { pilotId: 'acct-maya' }))
    expect(challengeProgress(w, 'acct-maya', c, '2026-11-13T00:00:00Z').items).toEqual(['KAVX'])
  })

  it('tracks states landed in for the Three-State Passport', () => {
    const w = seed()
    w.flights.push(flyLegs(w, outAndBack('KHND', 'KIFP'), '2026-11-14T17:00:00Z', { pilotId: 'acct-jordan' }))
    const p = challengeProgress(w, 'acct-jordan', challenge(w, 'three_state_passport'), '2026-10-01T00:00:00Z')
    expect(p.items).toEqual(['CA', 'NV', 'AZ'])
    expect(p.done).toBe(true)
  })

  it('recognizes a recorded no-go', () => {
    const w = seed()
    expect(challengeProgress(w, 'acct-lena', challenge(w, 'good_call'), '2026-10-01T00:00:00Z').done).toBe(true)
    expect(challengeProgress(w, 'acct-maya', challenge(w, 'good_call'), '2026-10-01T00:00:00Z').done).toBe(false)
  })
})
