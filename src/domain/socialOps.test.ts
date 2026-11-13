import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { feedFor } from './social'
import * as ops from './socialOps'
import { activeSignoffForMilestone, inboxFor, milestonesFor } from './signoffs'
import type { World } from './types'
import { canSeeProfile } from './visibility'
import { checkIntegrity } from './world'

let n = 0
const ctx = () => ({ id: `op-${++n}`, now: '2026-11-13T15:00:00.000Z' })

function seed(): World {
  if (!seedResult.ok) throw new Error('seed')
  return structuredClone(seedResult.world)
}

describe('Script B: Dan debriefs and signs off', () => {
  it('runs end to end and every intermediate world stays valid', () => {
    let w = seed()
    const before = inboxFor(w, 'acct-dan')
    expect(before.tagRequests.map((f) => f.id)).toEqual(['flt-sam-pattern'])
    expect(before.toSignOff.map((f) => f.id)).toEqual(['flt-maya-dual-xc'])
    expect(before.milestoneRequests.map((r) => r.milestone)).toEqual(['first_solo'])
    expect(before.simSessions.map((f) => f.id)).toEqual(['flt-lena-sim'])

    w = ops.addDebrief(w, 'acct-dan', 'flt-maya-dual-xc', 'Great pilotage. Work on the descent planning.', ctx())
    w = ops.signOffFlight(w, 'acct-dan', 'flt-maya-dual-xc', '', ctx())
    w = ops.signOffMilestone(w, 'acct-dan', 'acct-maya', 'first_solo', 'Solo at KHHR, three full stops.', true, ctx())
    expect(checkIntegrity(w)).toEqual([])

    const solo = milestonesFor(w, 'acct-maya').find((m) => m.code === 'first_solo')
    expect(solo?.signoff?.cfiId).toBe('acct-dan')
    expect(solo?.signoff?.clubId).toBe('club-hfa')
    expect(solo?.request).toBeNull()

    const after = inboxFor(w, 'acct-dan')
    expect(after.toSignOff).toEqual([])
    expect(after.milestoneRequests).toEqual([])

    const signoffId = solo?.signoff?.id ?? ''
    expect(() => ops.revokeSignoff(w, 'acct-dan', signoffId, '  ', ctx())).toThrow('reason')
    expect(() => ops.revokeSignoff(w, 'acct-kim', signoffId, 'not mine', ctx())).toThrow()
    w = ops.revokeSignoff(w, 'acct-dan', signoffId, 'Signed before the paperwork was checked', ctx())
    expect(activeSignoffForMilestone(w, 'acct-maya', 'first_solo')).toBeUndefined()
    // The pilot's own entry survives a revocation.
    expect(milestonesFor(w, 'acct-maya').find((m) => m.code === 'first_solo')?.claim).not.toBeNull()
    expect(checkIntegrity(w)).toEqual([])
  })

  it('accepting a tag puts the flight in the CFI’s queue to sign off', () => {
    let w = seed()
    w = ops.answerTag(w, 'acct-dan', 'flt-sam-pattern', true)
    expect(inboxFor(w, 'acct-dan').toSignOff.map((f) => f.id)).toContain('flt-sam-pattern')
    expect(() => ops.answerTag(w, 'acct-dan', 'flt-sam-pattern', true)).toThrow('No pending tag')
  })

  it('keeps outsiders out of the debrief', () => {
    expect(() => ops.addDebrief(seed(), 'acct-lena', 'flt-maya-dual-xc', 'hi', ctx())).toThrow()
  })
})

describe('social ops', () => {
  it('Jordan follows Maya (Public), gives Props and comments; Maya’s flights reach his feed', () => {
    let w = seed()
    expect(feedFor(w, 'acct-jordan').some((f) => f.pilotId === 'acct-maya')).toBe(false)
    w = ops.follow(w, 'acct-jordan', 'acct-maya', ctx())
    expect(feedFor(w, 'acct-jordan').some((f) => f.id === 'flt-maya-dual-xc')).toBe(true)
    w = ops.toggleProps(w, 'acct-jordan', 'flt-maya-dual-xc', ctx())
    w = ops.addComment(w, 'acct-jordan', 'flt-maya-dual-xc', ' Great flight! ', ctx())
    expect(w.comments.at(-1)?.text).toBe('Great flight!')
    w = ops.toggleProps(w, 'acct-jordan', 'flt-maya-dual-xc', ctx())
    expect(w.props.some((p) => p.accountId === 'acct-jordan' && p.flightId === 'flt-maya-dual-xc')).toBe(false)
    expect(checkIntegrity(w)).toEqual([])
  })

  it('asks a Private profile for approval and opens it once approved', () => {
    let w = seed()
    w = ops.follow(w, 'acct-jordan', 'acct-theo', ctx())
    expect(canSeeProfile(w, 'acct-jordan', 'acct-theo')).toBe(false)
    w = ops.answerFollowRequest(w, 'acct-theo', 'acct-jordan', true)
    expect(canSeeProfile(w, 'acct-jordan', 'acct-theo')).toBe(true)
  })

  it('auto-approves waiting requests when a profile goes Public, and keeps minors Private', () => {
    let w = seed()
    w = ops.setProfileLevel(w, 'acct-theo', 'public')
    expect(w.follows.find((f) => f.followerId === 'acct-marcus' && f.followeeId === 'acct-theo')?.status).toBe('accepted')
    expect(() => ops.setProfileLevel(w, 'acct-sam', 'discoverable')).toThrow('Minor')
  })

  it('blocking removes follows both ways and hides the profile', () => {
    let w = seed()
    w = ops.block(w, 'acct-maya', 'acct-lena', ctx())
    expect(w.follows.some((f) => [f.followerId, f.followeeId].includes('acct-lena') && [f.followerId, f.followeeId].includes('acct-maya'))).toBe(false)
    expect(canSeeProfile(w, 'acct-lena', 'acct-maya')).toBe(false)
    expect(() => ops.follow(w, 'acct-lena', 'acct-maya', ctx())).toThrow()
    w = ops.unblock(w, 'acct-maya', 'acct-lena')
    expect(canSeeProfile(w, 'acct-lena', 'acct-maya')).toBe(true)
  })

  it('lets a student record a milestone and ask their CFI to verify it', () => {
    let w = seed()
    w = ops.claimMilestone(w, 'acct-maya', 'first_solo_xc', ctx())
    w = ops.requestSignoff(w, 'acct-maya', 'acct-dan', 'first_solo_xc', ctx())
    expect(() => ops.requestSignoff(w, 'acct-maya', 'acct-dan', 'first_solo_xc', ctx())).toThrow()
    expect(inboxFor(w, 'acct-dan').milestoneRequests.map((r) => r.milestone)).toContain('first_solo_xc')
    expect(checkIntegrity(w)).toEqual([])
  })
})
