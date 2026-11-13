import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { createFlight } from './flights'
import { airportEvents, flightReviewStatus, landingsWithin, newlyEarned, recognitionFor, trackedTime } from './recognition'
import { importTrack } from './track/importTrack'
import { type Leg, synthesize, toGpx } from './track/synth'
import type { Flight, World } from './types'

function seed(): World {
  if (!seedResult.ok) throw new Error('seed')
  // These tests build their own flights; start from the seed's accounts with no flights.
  return { ...structuredClone(seedResult.world), flights: [] }
}

let n = 0
function fly(world: World, legs: Leg[], start: string, opts: { pilotId?: string; sim?: boolean } = {}): Flight {
  const r = importTrack(toGpx(synthesize(legs, world.airports, start), 'Test'), 't.gpx', world.airports)
  if (!r.ok) throw new Error(r.error)
  const draft = { ...r.draft, isSimulator: opts.sim ?? false }
  const f = createFlight(
    draft,
    { caption: '', routeVisibility: 'full', clubId: null, postVisibility: 'public', instructorId: null, flewWithIds: [] },
    opts.pilotId ?? 'acct-jordan',
    `f${++n}`,
    start,
  )
  world.flights.push(f)
  return f
}

const ground = (at: string, sec = 200): Leg => ({ kind: 'ground', at, sec })
const leg = (from: string, to: string, touchAndGo = false): Leg => ({ kind: 'fly', from, to, cruiseFt: 3500, kt: 110, touchAndGo })
/** A circuit at KTOA (a same-airport leg needs turn points). */
const pattern = (touchAndGo: boolean): Leg => ({
  kind: 'fly',
  from: 'KTOA',
  to: 'KTOA',
  via: [
    [33.83, -118.37],
    [33.79, -118.37],
  ],
  cruiseFt: 1100,
  kt: 80,
  touchAndGo,
})

describe('airportEvents', () => {
  it('counts a departure and a full-stop arrival', () => {
    const w = seed()
    const f = fly(w, [ground('KTOA'), leg('KTOA', 'KLGB'), ground('KLGB')], '2026-11-01T17:00:00Z')
    expect(Object.fromEntries(airportEvents(f))).toEqual({ KTOA: { landings: 0, takeoffs: 1 }, KLGB: { landings: 1, takeoffs: 0 } })
  })

  it('counts a touch-and-go as a landing and a takeoff, and a mid-trip stop as both', () => {
    const w = seed()
    const f = fly(
      w,
      [ground('KCNO'), leg('KCNO', 'KRAL', true), leg('KRAL', 'KPOC'), ground('KPOC', 600), leg('KPOC', 'KCNO'), ground('KCNO')],
      '2026-11-01T17:00:00Z',
    )
    expect(Object.fromEntries(airportEvents(f))).toEqual({
      KCNO: { landings: 1, takeoffs: 1 },
      KRAL: { landings: 1, takeoffs: 1 },
      KPOC: { landings: 1, takeoffs: 1 },
    })
  })
})

describe('recognitionFor', () => {
  it('accumulates airport counts, states and badges across flights in flown order', () => {
    const w = seed()
    fly(w, [ground('KTOA'), leg('KTOA', 'KPSP'), ground('KPSP')], '2026-11-02T17:00:00Z')
    fly(w, [ground('KTOA'), pattern(true), pattern(false), ground('KTOA')], '2026-11-01T17:00:00Z')
    const r = recognitionFor(w, 'acct-jordan')
    expect(r.flights).toBe(2)
    expect(r.airports.map((a) => [a.icao, a.landings, a.takeoffs])).toEqual([
      ['KTOA', 2, 3],
      ['KPSP', 1, 0],
    ])
    expect(r.states).toEqual(['CA'])
    expect(r.countries).toEqual(['US'])
    const codes = r.badges.map((b) => b.code)
    expect(codes).toContain('first_flight')
    expect(codes).toContain('first_touch_and_go')
    expect(codes).toContain('first_cross_country') // KTOA → KPSP is about 85 nm
  })

  it('counts states from landings, including Nevada', () => {
    const w = seed()
    fly(w, [ground('KHND'), leg('KHND', 'KBVU'), ground('KBVU')], '2026-11-01T17:00:00Z')
    fly(w, [ground('KIFP'), leg('KIFP', 'KEED'), ground('KEED')], '2026-11-02T17:00:00Z')
    const r = recognitionFor(w, 'acct-jordan')
    expect(r.states.sort()).toEqual(['AZ', 'CA', 'NV'])
    expect(r.badges.map((b) => b.code)).toContain('states_3')
  })

  it('gives sim sessions a first-sim badge and nothing else', () => {
    const w = seed()
    fly(w, [ground('KEMT'), leg('KEMT', 'KPOC'), ground('KPOC')], '2026-11-01T17:00:00Z', { sim: true })
    const r = recognitionFor(w, 'acct-jordan')
    expect(r.airports).toEqual([])
    expect(r.flights).toBe(0)
    expect(r.simSessions).toBe(1)
    expect(r.badges.filter((b) => b.family !== 'hours').map((b) => b.code)).toEqual(['first_sim'])
  })

  it('awards hours badges from the logbook total, labeled by its source', () => {
    const w = seed()
    const jordan = recognitionFor(w, 'acct-jordan') // 118 hrs, self-reported
    const hours = jordan.badges.filter((b) => b.family === 'hours')
    expect(hours.map((b) => b.code)).toEqual(['hours_10', 'hours_25', 'hours_40', 'hours_50', 'hours_100'])
    expect(hours.every((b) => b.source === 'self_reported')).toBe(true)
    const dan = recognitionFor(w, 'acct-dan') // 1,450 hrs, logbook verified
    expect(dan.badges.find((b) => b.code === 'hours_1000')?.source).toBe('logbook_verified')
    expect(dan.badges.some((b) => b.code === 'hours_1500')).toBe(false)
  })

  it('reports exactly what a new flight added', () => {
    const w = seed()
    fly(w, [ground('KTOA'), leg('KTOA', 'KLGB'), ground('KLGB')], '2026-11-01T17:00:00Z')
    const before = recognitionFor(w, 'acct-jordan')
    fly(w, [ground('KLGB'), leg('KLGB', 'KTOA'), ground('KTOA')], '2026-11-02T17:00:00Z')
    expect(newlyEarned(before, recognitionFor(w, 'acct-jordan'))).toEqual({ airports: [], badges: [] })
    fly(w, [ground('KTOA'), leg('KTOA', 'KSNA'), ground('KSNA')], '2026-11-03T17:00:00Z')
    const added = newlyEarned(before, recognitionFor(w, 'acct-jordan'))
    expect(added.airports.map((a) => a.icao)).toEqual(['KSNA'])
  })
})

describe('landingsWithin', () => {
  it('counts landings in the window and ignores sims and other pilots', () => {
    const w = seed()
    fly(w, [ground('KTOA'), pattern(true), pattern(false), ground('KTOA')], '2026-11-01T17:00:00Z')
    fly(w, [ground('KTOA'), leg('KTOA', 'KLGB'), ground('KLGB')], '2026-06-01T17:00:00Z')
    fly(w, [ground('KEMT'), leg('KEMT', 'KPOC'), ground('KPOC')], '2026-11-02T17:00:00Z', { sim: true })
    fly(w, [ground('KTOA'), leg('KTOA', 'KLGB'), ground('KLGB')], '2026-11-02T17:00:00Z', { pilotId: 'acct-maya' })
    expect(landingsWithin(w, 'acct-jordan', 90, new Date('2026-11-12T12:00:00Z'))).toBe(2)
  })
})

describe('flightReviewStatus', () => {
  const now = new Date('2026-11-12T12:00:00Z')
  it('is due at the end of the 24th calendar month', () => {
    expect(flightReviewStatus({ flightReviewOn: '2025-09-18' }, now)).toMatchObject({ dueBy: '2027-09-30', status: 'current' })
  })
  it('reminds within 90 days and flags overdue', () => {
    expect(flightReviewStatus({ flightReviewOn: '2024-12-05' }, now)).toMatchObject({ dueBy: '2026-12-31', status: 'due_soon' })
    expect(flightReviewStatus({ flightReviewOn: '2024-09-01' }, now)).toMatchObject({ dueBy: '2026-09-30', status: 'overdue' })
  })
  it('is unknown without a date', () => {
    expect(flightReviewStatus({ flightReviewOn: null }, now).status).toBe('unknown')
  })
})

describe('trackedTime', () => {
  it('adds airborne time from real flights and ignores simulator sessions', () => {
    const w = seed()
    const legs: Leg[] = [
      { kind: 'ground', at: 'KHHR', sec: 120 },
      { kind: 'fly', from: 'KHHR', to: 'KAVX', cruiseFt: 4500, kt: 110 },
      { kind: 'ground', at: 'KAVX', sec: 120 },
    ]
    const real = fly(w, legs, '2026-11-08T17:00:00Z', { pilotId: 'acct-jordan' })
    const sim = fly(w, legs, '2026-11-09T17:00:00Z', { pilotId: 'acct-jordan', sim: true })
    const t = trackedTime({ ...w, flights: [real, sim] }, 'acct-jordan')
    expect(t.flights).toBe(1)
    expect(t.hours).toBeCloseTo((real.stats.airborneSec ?? 0) / 3600, 1)
    expect(t.hours).toBeGreaterThan(0)
  })
})
