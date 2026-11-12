import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { makeClub, makeMembership } from '../test/factories'
import { awardForFlight, canConfirmSimSession, earnsXp } from './achievements'
import type { Achievement } from './types'

const airports = seedResult.ok ? seedResult.world.airports : []
const flight = (id: string, isSimulator = false) => ({ id, pilotId: 'acct-test', isSimulator, createdAt: '2026-11-08T18:00:00.000Z' })

describe('awardForFlight', () => {
  it('gives a first-flight badge and a stamp per new airport', () => {
    const got = awardForFlight(flight('f1'), ['KHHR', 'KAVX'], [], airports)
    expect(got.map((a) => a.code)).toEqual(['badge:first_flight', 'stamp:KHHR', 'stamp:KAVX'])
    expect(got.find((a) => a.code === 'stamp:KAVX')?.title).toBe('Catalina')
  })

  it("doesn't award anything the pilot already has", () => {
    const first = awardForFlight(flight('f1'), ['KHHR', 'KAVX'], [], airports)
    const second = awardForFlight(flight('f2'), ['KHHR', 'KTOA'], first, airports)
    expect(second.map((a) => a.code)).toEqual(['stamp:KTOA'])
  })

  it("ignores other pilots' achievements", () => {
    const other: Achievement[] = awardForFlight({ ...flight('x'), pilotId: 'someone-else' }, ['KHHR'], [], airports)
    expect(awardForFlight(flight('f1'), ['KHHR'], other, airports).map((a) => a.code)).toContain('stamp:KHHR')
  })

  it('awards the five-airports badge on the fifth stamp', () => {
    const before = awardForFlight(flight('f1'), ['KHHR', 'KAVX', 'KTOA', 'KLGB'], [], airports)
    const got = awardForFlight(flight('f2'), ['KSMO'], before, airports)
    expect(got.map((a) => a.code)).toEqual(['stamp:KSMO', 'badge:airports_5'])
  })

  it('gives simulator sessions no stamps or badges', () => {
    expect(awardForFlight(flight('sim', true), ['KEMT', 'KPOC'], [], airports)).toEqual([])
  })
})

describe('earnsXp', () => {
  const school = makeClub({ id: 'club-s' })
  const community = makeClub({ id: 'club-c', kind: 'community', plan: 'community' })
  const member = makeMembership({ accountId: 'acct-test', clubId: 'club-s' })
  const confirmed = { status: 'confirmed' as const, byAccountId: 'acct-admin', at: '2026-11-09T10:00:00.000Z' }
  const pending = { status: 'pending' as const, byAccountId: null, at: null }
  const sim = (clubId: string | null, simConfirmation: typeof confirmed | typeof pending | null) => ({
    pilotId: 'acct-test',
    isSimulator: true,
    clubId,
    simConfirmation,
  })

  it('always counts real flights', () => {
    expect(earnsXp({ pilotId: 'acct-test', isSimulator: false, clubId: null, simConfirmation: null }, [], [])).toBe(true)
  })
  it('counts a sim session only once the school confirms it', () => {
    expect(earnsXp(sim('club-s', pending), [school], [member])).toBe(false)
    expect(earnsXp(sim('club-s', { ...confirmed, status: 'declined' } as never), [school], [member])).toBe(false)
    expect(earnsXp(sim('club-s', confirmed), [school], [member])).toBe(true)
  })
  it('does not count an untagged session, a community-club tag, or a school the pilot left', () => {
    expect(earnsXp(sim(null, null), [school], [member])).toBe(false)
    expect(earnsXp(sim('club-c', confirmed), [community], [makeMembership({ clubId: 'club-c' })])).toBe(false)
    expect(earnsXp(sim('club-s', confirmed), [school], [{ ...member, status: 'former', endedOn: '2026-01-02' }])).toBe(false)
  })
})

describe('canConfirmSimSession', () => {
  const flight = { pilotId: 'acct-test', isSimulator: true, clubId: 'club-s', simConfirmation: { status: 'pending' as const, byAccountId: null, at: null } }
  const role = (accountId: string, roles: ('member' | 'staff_cfi' | 'admin')[]) => makeMembership({ id: `m-${accountId}`, accountId, clubId: 'club-s', roles })

  it('lets an admin or staff CFI of the tagged school confirm', () => {
    expect(canConfirmSimSession(flight, 'acct-admin', [role('acct-admin', ['admin'])])).toBe(true)
    expect(canConfirmSimSession(flight, 'acct-cfi', [role('acct-cfi', ['staff_cfi'])])).toBe(true)
  })
  it('refuses ordinary members, the pilot themself and real flights', () => {
    expect(canConfirmSimSession(flight, 'acct-other', [role('acct-other', ['member'])])).toBe(false)
    expect(canConfirmSimSession(flight, 'acct-test', [role('acct-test', ['admin'])])).toBe(false)
    expect(canConfirmSimSession({ ...flight, isSimulator: false, simConfirmation: null }, 'acct-admin', [role('acct-admin', ['admin'])])).toBe(false)
  })
})
