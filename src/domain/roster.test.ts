import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { adviceFor } from './advisor'
import { assignMission, openAssignmentsFor, rosterFor, withdrawAssignment } from './roster'
import type { World } from './types'
import { checkIntegrity } from './world'

function seed(): World {
  if (!seedResult.ok) throw new Error('seed')
  return structuredClone(seedResult.world)
}
const ctx = (id = 'a1') => ({ id, now: '2026-11-13T18:00:00.000Z' })

describe('CFI Pro roster', () => {
  it("lists Dan's students with their progress", () => {
    const rows = rosterFor(seed(), 'acct-dan')
    const maya = rows.find((r) => r.student.id === 'acct-maya')
    expect(maya?.pathway).toEqual({ done: 1, total: 5 })
    expect(maya?.openRequests).toBe(1)
    expect(rows.every((r) => r.student.id !== 'acct-dan')).toBe(true)
  })

  it('is part of CFI Pro', () => {
    // Priya is an independent verified CFI without CFI Pro.
    expect(() => rosterFor(seed(), 'acct-priya')).toThrow(/CFI Pro/)
  })
})

describe('mission suggestions', () => {
  it('puts the CFI’s suggestion first in the advisor until it’s flown or withdrawn', () => {
    let w = seed()
    expect(adviceFor(w, 'acct-maya')?.mission.code).toBe('airport_in_the_sky')
    w = assignMission(w, 'acct-dan', { studentId: 'acct-maya', missionCode: 'santa_paula', note: 'Good practice for short runways.' }, ctx())
    expect(checkIntegrity(w)).toEqual([])
    const advice = adviceFor(w, 'acct-maya')
    expect(advice?.mission.code).toBe('santa_paula')
    expect(advice?.context).toBe('Dan suggests')
    expect(advice?.reasons[0]).toBe('“Good practice for short runways.”')
    expect(advice?.handoff).toContain('Your CFI decides')
    expect(() => assignMission(w, 'acct-dan', { studentId: 'acct-maya', missionCode: 'santa_paula', note: '' }, ctx('a2'))).toThrow(/already suggested/)
    w = withdrawAssignment(w, 'acct-dan', 'a1', ctx())
    expect(openAssignmentsFor(w, 'acct-maya')).toEqual([])
    expect(adviceFor(w, 'acct-maya')?.mission.code).toBe('airport_in_the_sky')
  })

  it('only for linked students, missions not yet flown, by CFI Pro', () => {
    const w = seed()
    expect(() => assignMission(w, 'acct-dan', { studentId: 'acct-jordan', missionCode: 'santa_paula', note: '' }, ctx())).toThrow(/your own students/)
    expect(() => assignMission(w, 'acct-dan', { studentId: 'acct-maya', missionCode: 'class_c_arrival', note: '' }, ctx())).toThrow(/already flown/)
    expect(() => assignMission(w, 'acct-maya', { studentId: 'acct-maya', missionCode: 'santa_paula', note: '' }, ctx())).toThrow(/CFI Pro/)
    expect(() => withdrawAssignment(w, 'acct-dan', 'nope', ctx())).toThrow(/not found/)
  })
})
