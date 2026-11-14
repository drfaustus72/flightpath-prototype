import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { flyLegs, outAndBack } from '../test/flights'
import { adviceFor, pathwaySteps } from './advisor'
import type { World } from './types'

function seed(): World {
  if (!seedResult.ok) throw new Error('seed')
  return structuredClone(seedResult.world)
}

describe('adviceFor', () => {
  it('suggests Airport in the Sky as Maya’s first pathway step and hands the call to her CFI', () => {
    const a = adviceFor(seed(), 'acct-maya')
    expect(a?.mission.code).toBe('airport_in_the_sky')
    expect(a?.context).toBe('Next on Private Pilot Cross-Country: step 1 of 5')
    expect(a?.handoff).toContain('Dan')
    expect(a?.handoff).toContain('Your CFI decides')
  })

  it('moves to the next step once the track completes one', () => {
    const w = seed()
    w.flights.push(flyLegs(w, outAndBack('KHHR', 'KAVX'), '2026-11-14T17:00:00Z', { pilotId: 'acct-maya', clubId: 'club-hfa' }))
    // Class C is already done on her Burbank arrival, so the advisor skips to the coastal cross-country.
    expect(adviceFor(w, 'acct-maya')?.mission.code).toBe('coastal_xc')
    expect(pathwaySteps(w, 'acct-maya', w.pathways[0] ?? { code: 'x', title: '', description: '', missionCodes: [] })[0]?.complete).toBe(true)
  })

  it('never tells anyone they are ready', () => {
    const w = seed()
    for (const a of w.accounts) {
      const advice = adviceFor(w, a.id)
      const text = advice ? [advice.context, ...advice.reasons, advice.handoff].join(' ') : ''
      expect(text).not.toMatch(/you are ready|you're ready to|you’re ready to|ready for/i)
    }
  })

  it('skips missions whose milestones the pilot has not reached', () => {
    const w = seed()
    // Maya has no first solo XC milestone, so High Country (after private checkride) is never suggested.
    w.pathways = []
    expect(adviceFor(w, 'acct-maya')?.mission.suggestAfter ?? []).toEqual([])
  })
})
