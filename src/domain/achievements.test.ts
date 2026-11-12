import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { makeClub, makeMembership } from '../test/factories'
import { awardForFlight, earnsXp } from './achievements'
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

  it('always counts real flights', () => {
    expect(earnsXp({ pilotId: 'acct-test', isSimulator: false, clubId: null }, [], [])).toBe(true)
  })
  it('counts a sim session tagged to a school the pilot belongs to', () => {
    expect(earnsXp({ pilotId: 'acct-test', isSimulator: true, clubId: 'club-s' }, [school], [member])).toBe(true)
  })
  it('does not count an untagged sim session, a community-club tag, or a school the pilot left', () => {
    expect(earnsXp({ pilotId: 'acct-test', isSimulator: true, clubId: null }, [school], [member])).toBe(false)
    expect(
      earnsXp({ pilotId: 'acct-test', isSimulator: true, clubId: 'club-c' }, [community], [makeMembership({ clubId: 'club-c' })]),
    ).toBe(false)
    expect(
      earnsXp({ pilotId: 'acct-test', isSimulator: true, clubId: 'club-s' }, [school], [{ ...member, status: 'former', endedOn: '2026-01-02' }]),
    ).toBe(false)
  })
})
