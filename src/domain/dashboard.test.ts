import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { makeAccount, makeClub, makeFlight, makeMembership, makeWorld } from '../test/factories'
import { dataAsOf, schoolDashboard } from './dashboard'
import type { World } from './types'

function seed(): World {
  if (!seedResult.ok) throw new Error('seed')
  return structuredClone(seedResult.world)
}

describe('schoolDashboard', () => {
  it("shows Hawthorne's seeded roster: 12 flying, 6 gone quiet, longest gap first", () => {
    const w = seed()
    const asOf = dataAsOf(w)
    if (!asOf) throw new Error('no flights')
    const d = schoolDashboard(w, 'club-hfa', asOf)
    expect(d.active).toBe(12)
    expect(d.inactive).toBe(6)
    expect(d.members.slice(0, 6).map((m) => m.account.displayName)).toEqual([
      'Sofia Petrova',
      'Ravi Shah',
      'Olivia Grant',
      'Noah Castillo',
      'Mia Rossi',
      'Liam O’Connor',
    ])
    // Staff aren't counted as pilot members.
    expect(d.members.some((m) => m.account.id === 'acct-dan' || m.account.id === 'acct-alex')).toBe(false)
    expect(d.weekly).toHaveLength(12)
    expect(d.weekly.reduce((n, w) => n + w.flights, 0)).toBeGreaterThan(30)
    expect(d.openMilestoneRequests).toBe(1)
  })

  const pilot = makeAccount({ id: 'p', displayName: 'Pat' })
  const base = (flights: ReturnType<typeof makeFlight>[]) =>
    makeWorld({ accounts: [pilot], clubs: [makeClub()], memberships: [makeMembership({ accountId: 'p' })], flights })
  const asOf = '2026-11-12T18:00:00.000Z'

  it('counts a member active only for real, school-tagged flights in the last 30 days', () => {
    const sim = makeFlight({ id: 's', pilotId: 'p', clubId: 'club-test', isSimulator: true, startedAt: '2026-11-10T10:00:00.000Z' })
    const untagged = makeFlight({ id: 'u', pilotId: 'p', clubId: null, startedAt: '2026-11-10T10:00:00.000Z' })
    const old = makeFlight({ id: 'o', pilotId: 'p', clubId: 'club-test', startedAt: '2026-10-01T10:00:00.000Z' })
    const [m] = schoolDashboard(base([sim, untagged, old]), 'club-test', asOf).members
    expect(m?.status).toBe('inactive')
    expect(m?.daysSince).toBe(42)
  })

  it('ignores flights after asOf and puts never-flown members first', () => {
    const later = makeFlight({ id: 'l', pilotId: 'p', clubId: 'club-test', startedAt: '2026-11-20T10:00:00.000Z' })
    const [m] = schoolDashboard(base([later]), 'club-test', asOf).members
    expect(m?.lastFlightAt).toBeNull()
    expect(m?.status).toBe('inactive')
  })

  it('buckets flights into weeks ending at asOf', () => {
    const f = makeFlight({ id: 'f', pilotId: 'p', clubId: 'club-test', startedAt: '2026-11-12T10:00:00.000Z' })
    const d = schoolDashboard(base([f]), 'club-test', asOf, 4)
    expect(d.weekly.map((w) => w.flights)).toEqual([0, 0, 0, 1])
    expect(d.active).toBe(1)
  })
})
