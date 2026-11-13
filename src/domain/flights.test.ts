import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { canViewFlight, feedFor, formatDuration, routeForViewer } from './flights'
import type { Flight, World } from './types'

const route: [number, number][] = Array.from({ length: 41 }, (_, i) => [-118.335 + i * 0.005, 33.9228])

const flight = (over: Partial<Flight> = {}): Flight => ({
  id: 'f1',
  pilotId: 'acct-maya',
  title: 'Test',
  startedAt: '2026-11-08T17:00:00.000Z',
  source: { fileName: 'x.gpx', app: null, gpsSource: null },
  isSimulator: false,
  stats: { distanceNm: 10, durationSec: 600, airborneSec: 500, maxAltitudeFt: 3000, maxGroundspeedKt: 110 },
  departure: 'KHHR',
  arrival: null,
  landings: [],
  route,
  importNotes: [],
  caption: '',
  routeVisibility: 'full',
  clubId: null,
  simConfirmation: null,
  postVisibility: 'public',
  instructor: null,
  flewWith: [],
  createdAt: '2026-11-08T18:00:00.000Z',
  ...over,
})

const world = (flights: Flight[]): World => {
  if (!seedResult.ok) throw new Error('seed')
  return { ...seedResult.world, flights }
}

describe('routeForViewer', () => {
  it('shows the full route to the pilot whatever the setting', () => {
    expect(routeForViewer(flight({ routeVisibility: 'hidden' }), 'acct-maya')).toHaveLength(41)
  })
  it('hides the route from others when hidden', () => {
    expect(routeForViewer(flight({ routeVisibility: 'hidden' }), 'acct-dan')).toBeNull()
  })
  it('trims about 1 nm from each end for hide_ends', () => {
    const r = routeForViewer(flight({ routeVisibility: 'hide_ends' }), 'acct-dan')
    expect(r).not.toBeNull()
    expect(r?.length).toBeLessThan(41)
    expect(r?.[0]?.[0]).toBeGreaterThan(-118.335 + 0.015)
  })
  it('hides a route too short to trim', () => {
    expect(routeForViewer(flight({ routeVisibility: 'hide_ends', route: route.slice(0, 5) }), 'acct-dan')).toBeNull()
  })
})

describe('feed visibility', () => {
  it("shows others' public flights but not private ones", () => {
    const w = world([flight(), flight({ id: 'f2', postVisibility: 'private' })])
    expect(feedFor(w, 'acct-dan').map((f) => f.id)).toEqual(['f1'])
    expect(feedFor(w, 'acct-maya').map((f) => f.id).sort()).toEqual(['f1', 'f2'])
  })
  it("never shows a minor's flight to anyone else", () => {
    const w = world([flight({ pilotId: 'acct-sam' })])
    expect(canViewFlight(w, w.flights[0] as Flight, 'acct-dan')).toBe(false)
  })
  it('orders newest first', () => {
    const w = world([flight({ id: 'old', startedAt: '2026-10-01T00:00:00.000Z' }), flight({ id: 'new' })])
    expect(feedFor(w, 'acct-maya').map((f) => f.id)).toEqual(['new', 'old'])
  })
})

describe('formatDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration(2092)).toBe('35m')
    expect(formatDuration(5400)).toBe('1h 30m')
    expect(formatDuration(null)).toBe('—')
  })
})
