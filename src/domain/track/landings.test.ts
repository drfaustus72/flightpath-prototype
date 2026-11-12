import { describe, expect, it } from 'vitest'
import { seedResult } from '../../data/seed'
import foreflightKml from '../../test/fixtures/foreflight-kemt-kpoc-sim.kml?raw'
import type { Airport } from '../types'
import { importTrack } from './importTrack'
import { analyzeLandings } from './landings'
import { type Leg, synthesize, toGpx } from './synth'

const airports: Airport[] = seedResult.ok ? seedResult.world.airports : []
const START = '2026-11-08T17:00:00Z'

function run(legs: Leg[]) {
  return analyzeLandings(synthesize(legs, airports, START), airports)
}

describe('landing detection', () => {
  it('finds KEMT → KPOC in the real ForeFlight export and flags it as a simulator session', () => {
    const r = importTrack(foreflightKml, 'tracklog.kml', airports)
    if (!r.ok) throw new Error(r.error)
    expect(r.draft.departure).toBe('KEMT')
    expect(r.draft.arrival).toBe('KPOC')
    expect(r.draft.airportsVisited).toEqual(['KEMT', 'KPOC'])
    expect(r.draft.isSimulator).toBe(true)
    expect(r.draft.title).toBe('KEMT → KPOC')
    expect(r.draft.importNotes.join(' ')).toMatch(/3 GPS glitches removed/)
    expect(r.draft.importNotes.join(' ')).toMatch(/Simulator session \(X-Plane\)/)
    expect(r.draft.route.length).toBeLessThanOrEqual(400)
  })

  it('detects a round trip with a full-stop landing at the destination', () => {
    const r = run([
      { kind: 'ground', at: 'KHHR', sec: 300 },
      { kind: 'fly', from: 'KHHR', to: 'KAVX', cruiseFt: 4500, kt: 110 },
      { kind: 'ground', at: 'KAVX', sec: 2400 },
      { kind: 'fly', from: 'KAVX', to: 'KHHR', cruiseFt: 3500, kt: 110 },
      { kind: 'ground', at: 'KHHR', sec: 180 },
    ])
    expect(r.departure).toBe('KHHR')
    expect(r.arrival).toBe('KHHR')
    expect(r.landings.map((l) => `${l.kind}:${l.icao}`)).toEqual(['full_stop:KAVX', 'full_stop:KHHR'])
    expect(r.airportsVisited).toEqual(['KHHR', 'KAVX'])
  })

  it('counts touch-and-goes in the pattern without counting the takeoff or final landing as one', () => {
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
    const r = run([{ kind: 'ground', at: 'KTOA', sec: 240 }, pattern(true), pattern(true), pattern(true), pattern(false), { kind: 'ground', at: 'KTOA', sec: 120 }])
    expect(r.landings.map((l) => l.kind)).toEqual(['touch_and_go', 'touch_and_go', 'touch_and_go', 'full_stop'])
    expect(r.airportsVisited).toEqual(['KTOA'])
  })

  it('counts a touch-and-go at another airport on the way', () => {
    const r = run([
      { kind: 'ground', at: 'KCNO', sec: 200 },
      { kind: 'fly', from: 'KCNO', to: 'KRAL', cruiseFt: 3000, kt: 100, touchAndGo: true },
      { kind: 'fly', from: 'KRAL', to: 'KCNO', cruiseFt: 3000, kt: 100 },
      { kind: 'ground', at: 'KCNO', sec: 100 },
    ])
    expect(r.landings.map((l) => `${l.kind}:${l.icao}`)).toEqual(['touch_and_go:KRAL', 'full_stop:KCNO'])
    expect(r.airportsVisited).toEqual(['KCNO', 'KRAL'])
  })

  it('records a stop away from any known airport as an unknown landing', () => {
    const t0 = Date.parse(START)
    const farm = { lat: 34.6, lon: -118.9 }
    const points = [
      ...Array.from({ length: 30 }, (_, i) => ({ t: t0 + i * 4000, lat: farm.lat + i * 0.004, lon: farm.lon, altFt: 3000 })),
      ...Array.from({ length: 15 }, (_, i) => ({ t: t0 + 120_000 + i * 4000, lat: farm.lat + 0.12, lon: farm.lon + i * 0.00002, altFt: 1200 })),
    ]
    const r = analyzeLandings(points, airports)
    expect(r.landings).toHaveLength(1)
    expect(r.landings[0]?.icao).toBeNull()
    expect(r.departure).toBeNull()
  })

  it('round-trips a synthetic track through GPX and the full importer', () => {
    const points = synthesize(
      [
        { kind: 'ground', at: 'KCNO', sec: 200 },
        { kind: 'fly', from: 'KCNO', to: 'L35', cruiseFt: 9500, kt: 105 },
        { kind: 'ground', at: 'L35', sec: 600 },
      ],
      airports,
      START,
    )
    const r = importTrack(toGpx(points, 'Big Bear'), 'big-bear.gpx', airports)
    if (!r.ok) throw new Error(r.error)
    expect(r.draft.title).toBe('Big Bear')
    expect(r.draft.airportsVisited).toEqual(['KCNO', 'L35'])
    expect(r.draft.isSimulator).toBe(false)
    expect(r.draft.importNotes).toEqual([])
  })
})
