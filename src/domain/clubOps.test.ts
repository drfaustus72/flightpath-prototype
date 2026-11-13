import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import * as ops from './clubOps'
import type { World } from './types'
import { homeSchoolOf, checkIntegrity } from './world'

let n = 0
const ctx = () => ({ id: `club-op-${++n}`, now: '2026-11-13T18:00:00.000Z' })
function seed(): World {
  if (!seedResult.ok) throw new Error('seed')
  return structuredClone(seedResult.world)
}

describe('joining', () => {
  it('waits for a claimed school to approve, and only its admin can', () => {
    let w = ops.requestJoin(seed(), 'acct-jordan', 'club-hfa', ctx())
    const pending = ops.pendingJoinRequests(w, 'club-hfa')
    expect(pending.map((m) => m.accountId)).toEqual(['acct-jordan'])
    expect(() => ops.requestJoin(w, 'acct-jordan', 'club-hfa', ctx())).toThrow()
    const id = pending[0]?.id ?? ''
    expect(() => ops.answerJoinRequest(w, 'acct-dan', id, true, ctx())).toThrow()
    w = ops.answerJoinRequest(w, 'acct-alex', id, true, ctx())
    expect(ops.currentMembership(w, 'acct-jordan', 'club-hfa')?.status).toBe('active')
    expect(checkIntegrity(w)).toEqual([])
  })

  it('records an unclaimed school right away, as a self-reported affiliation', () => {
    const w = ops.requestJoin(seed(), 'acct-jordan', 'club-desert', ctx())
    const m = ops.currentMembership(w, 'acct-jordan', 'club-desert')
    expect(m?.status).toBe('active')
    expect(m && ops.isSelfReportedAffiliation(w, m)).toBe(true)
  })

  it('lets a pilot cancel a request, choose a home school and leave', () => {
    let w = ops.requestJoin(seed(), 'acct-jordan', 'club-smo', ctx())
    w = ops.cancelJoinRequest(w, 'acct-jordan', 'club-smo')
    expect(ops.currentMembership(w, 'acct-jordan', 'club-smo')).toBeUndefined()
    expect(() => ops.setHomeSchool(w, 'acct-jordan', 'club-taildraggers')).toThrow('flight school or flying club')
    w = ops.leaveClub(w, 'acct-jordan', 'club-coastal', ctx())
    expect(homeSchoolOf(w, 'acct-jordan')).toBeNull()
    expect(w.memberships.find((m) => m.id === 'mem-jordan-coastal')?.endedOn).toBe('2026-11-13')
    expect(checkIntegrity(w)).toEqual([])
  })

  it("doesn't let a school's only admin leave", () => {
    expect(() => ops.leaveClub(seed(), 'acct-alex', 'club-hfa', ctx())).toThrow('another admin')
  })
})

describe('claiming a page', () => {
  it('needs an email at the school’s website domain, then makes the claimer its admin', () => {
    const w0 = seed()
    const desert = w0.clubs.find((c) => c.id === 'club-desert')
    if (!desert) throw new Error('desert')
    expect(ops.checkClaimEmail(desert, 'owner@gmail.com').ok).toBe(false)
    expect(ops.checkClaimEmail(desert, 'Owner@DesertWings.example').ok).toBe(true)
    expect(() => ops.claimClub(w0, 'acct-jordan', 'club-desert', 'x@gmail.com', ctx())).toThrow()

    let w = ops.requestJoin(w0, 'acct-maya', 'club-desert', ctx())
    w = ops.claimClub(w, 'acct-jordan', 'club-desert', 'jordan@desertwings.example', ctx())
    expect(w.clubs.find((c) => c.id === 'club-desert')?.claimed).toBe(true)
    expect(ops.isAdminOf(w, 'acct-jordan', 'club-desert')).toBe(true)
    // Earlier affiliations stay, now confirmed by a claimed school.
    const maya = ops.currentMembership(w, 'acct-maya', 'club-desert')
    expect(maya && ops.isSelfReportedAffiliation(w, maya)).toBe(false)
    expect(() => ops.claimClub(w, 'acct-maya', 'club-desert', 'maya@desertwings.example', ctx())).toThrow('Already claimed')
    expect(checkIntegrity(w)).toEqual([])
  })

  it('turns the CFI directory listing off without touching CFI status', () => {
    const w = ops.setCfiListed(seed(), 'acct-dan', false)
    const dan = w.accounts.find((a) => a.id === 'acct-dan')
    expect(dan?.cfi).toMatchObject({ verified: true, listed: false })
  })
})
