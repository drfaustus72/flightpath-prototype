import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import type { Signoff, World } from './types'
import { rankFor, xpSummary } from './xp'

function seed(): World {
  if (!seedResult.ok) throw new Error('seed')
  return structuredClone(seedResult.world)
}
const milestone = (over: Partial<Signoff>): Signoff => ({
  id: 'x',
  cfiId: 'acct-dan',
  studentId: 'acct-maya',
  flightId: null,
  milestone: 'first_solo',
  clubId: 'club-hfa',
  note: '',
  schoolAircraft: true,
  at: '2026-11-13T00:00:00.000Z',
  revoked: null,
  ...over,
})

describe('ranks', () => {
  it('steps through Explorer, Navigator, Pathfinder, Trailblazer', () => {
    expect(rankFor(0)).toEqual({ rank: 'Explorer', nextRank: { name: 'Navigator', xpToGo: 500 } })
    expect(rankFor(1500).rank).toBe('Pathfinder')
    expect(rankFor(9999)).toEqual({ rank: 'Trailblazer', nextRank: null })
  })
})

describe('xpSummary', () => {
  it('counts a verified mission at the school it was flown for', () => {
    const [lena] = xpSummary(seed(), 'acct-lena')
    expect(lena?.club.id).toBe('club-hfa')
    expect(lena?.xp).toBe(300)
    expect(lena?.entries.map((e) => e.title)).toEqual(['Coastal Cross-Country'])
  })

  it('counts a milestone signed for the school only when flown in its aircraft', () => {
    // Leave out Maya's seeded mission so only the milestone counts.
    const w = { ...seed(), missionVerifications: [] }
    expect(xpSummary({ ...w, signoffs: [milestone({})] }, 'acct-maya')[0]?.xp).toBe(300)
    expect(xpSummary({ ...w, signoffs: [milestone({ schoolAircraft: false })] }, 'acct-maya')[0]?.xp).toBe(0)
    expect(xpSummary({ ...w, signoffs: [milestone({ revoked: { at: '2026-11-14T00:00:00.000Z', reason: 'x' } })] }, 'acct-maya')[0]?.xp).toBe(0)
  })

  it('drops XP when a verification is revoked', () => {
    const w = seed()
    w.missionVerifications = w.missionVerifications.map((v) => ({ ...v, revoked: { at: '2026-11-14T00:00:00.000Z', reason: 'Wrong flight' } }))
    expect(xpSummary(w, 'acct-lena')[0]?.xp).toBe(0)
  })

  it('holds no XP for pilots without a School Pro school (School Basic, independent, none)', () => {
    const w = seed()
    expect(xpSummary(w, 'acct-jordan')).toEqual([])
    expect(xpSummary(w, 'acct-marcus')).toEqual([])
  })

  it('stays with the old school when a pilot switches; the new school starts at 0', () => {
    const w = seed()
    w.clubs.push({ id: 'club-new', name: 'Bayside Flight Center', kind: 'flight_school', plan: 'school_pro', claimed: true, homeAirport: 'KTOA', website: null, initials: 'BFC', about: '', trainingOffered: ['private'] })
    w.memberships = w.memberships.map((m) => (m.id === 'mem-lena-hfa' ? { ...m, status: 'former' as const, isHomeSchool: false, endedOn: '2026-11-12' } : m))
    w.memberships.push({ id: 'mem-lena-new', accountId: 'acct-lena', clubId: 'club-new', roles: ['member'], status: 'active', isHomeSchool: true, sponsoredPilotPro: false, startedOn: '2026-11-12', endedOn: null })
    expect(xpSummary(w, 'acct-lena').map((s) => [s.club.id, s.xp])).toEqual([['club-new', 0]])
    // The record stays with Hawthorne: rejoining brings it back.
    w.memberships = w.memberships.map((m) => (m.id === 'mem-lena-hfa' ? { ...m, status: 'active' as const, endedOn: null } : m))
    expect(xpSummary(w, 'acct-lena').find((s) => s.club.id === 'club-hfa')?.xp).toBe(300)
  })

  it('counts a self-reported mission the school verified, only if flown in its aircraft', () => {
    const w = seed()
    const v = { id: 'v', pilotId: 'acct-maya', missionCode: 'santa_paula', flightId: null, clubId: 'club-hfa', byAccountId: 'acct-alex', at: '2026-11-13T00:00:00.000Z', revoked: null }
    expect(xpSummary({ ...w, missionVerifications: [{ ...v, schoolAircraft: true }] }, 'acct-maya')[0]?.xp).toBe(150)
    expect(xpSummary({ ...w, missionVerifications: [{ ...v, schoolAircraft: false }] }, 'acct-maya')[0]?.xp).toBe(0)
  })
})
