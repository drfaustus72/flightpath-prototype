/**
 * Regenerates src/data/seed/flights.json from fictional synthetic tracks between real airports.
 * Run with: npx jiti scripts/seed-flights.ts
 *
 * Tracks go through the same import pipeline as an uploaded file, so seed flights have
 * realistic stats, landings and simplified routes. Social fields (tags, visibility) are set here.
 */
import { writeFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import airports from '../src/data/seed/airports.json'
import { createFlight, type PostChoices } from '../src/domain/flights'
import { importTrack } from '../src/domain/track/importTrack'
import { type Leg, synthesize, toGpx } from '../src/domain/track/synth'
import type { Airport, Flight, Tag } from '../src/domain/types'

globalThis.DOMParser = new JSDOM().window.DOMParser

interface SeedFlight {
  id: string
  pilotId: string
  title: string
  start: string
  legs: Leg[]
  caption: string
  clubId: string | null
  postVisibility: Flight['postVisibility']
  instructor?: Tag
  flewWith?: Tag[]
  simulator?: string
}

const pattern = (at: string, via: [number, number][], touchAndGo: boolean): Leg => ({
  kind: 'fly',
  from: at,
  to: at,
  via,
  cruiseFt: 1100,
  kt: 80,
  touchAndGo,
})
const hhrPattern = (tg: boolean) => pattern('KHHR', [[33.94, -118.36], [33.9, -118.36]], tg)

const FLIGHTS: SeedFlight[] = [
  {
    id: 'flt-maya-pattern',
    pilotId: 'acct-maya',
    title: 'Pattern work at Hawthorne',
    start: '2026-11-03T16:00:00Z',
    legs: [{ kind: 'ground', at: 'KHHR', sec: 360 }, hhrPattern(true), hhrPattern(true), hhrPattern(false), { kind: 'ground', at: 'KHHR', sec: 200 }],
    caption: 'Three landings with a gusty crosswind. Getting there.',
    clubId: 'club-hfa',
    postVisibility: 'public',
    instructor: { accountId: 'acct-dan', status: 'accepted' },
  },
  {
    id: 'flt-maya-dual-xc',
    pilotId: 'acct-maya',
    title: 'Dual cross-country to Camarillo',
    start: '2026-11-10T17:30:00Z',
    legs: [
      { kind: 'ground', at: 'KHHR', sec: 420 },
      { kind: 'fly', from: 'KHHR', to: 'KCMA', via: [[34.02, -118.62]], cruiseFt: 4500, kt: 110 },
      { kind: 'ground', at: 'KCMA', sec: 900 },
      { kind: 'fly', from: 'KCMA', to: 'KHHR', via: [[34.0, -118.6]], cruiseFt: 3500, kt: 110 },
      { kind: 'ground', at: 'KHHR', sec: 240 },
    ],
    caption: 'Flew the whole route on pilotage. Dan only touched the radio once.',
    clubId: 'club-hfa',
    postVisibility: 'public',
    instructor: { accountId: 'acct-dan', status: 'accepted' },
  },
  {
    id: 'flt-lena-sba',
    pilotId: 'acct-lena',
    title: 'Breakfast in Santa Barbara',
    start: '2026-11-09T16:00:00Z',
    legs: [
      { kind: 'ground', at: 'KHHR', sec: 480 },
      { kind: 'fly', from: 'KHHR', to: 'KSBA', via: [[34.02, -118.62], [34.15, -119.2]], cruiseFt: 5500, kt: 115 },
      { kind: 'ground', at: 'KSBA', sec: 300 },
    ],
    caption: 'Marine layer burned off just in time.',
    clubId: 'club-hfa',
    postVisibility: 'public',
  },
  {
    id: 'flt-lena-sim',
    pilotId: 'acct-lena',
    title: 'Simulator: approaches into Hawthorne',
    start: '2026-11-11T19:00:00Z',
    legs: [{ kind: 'ground', at: 'KHHR', sec: 120 }, hhrPattern(true), hhrPattern(false), { kind: 'ground', at: 'KHHR', sec: 120 }],
    caption: '',
    clubId: 'club-hfa',
    postVisibility: 'followers',
    simulator: 'Redbird FMX',
  },
  {
    id: 'flt-dan-coast',
    pilotId: 'acct-dan',
    title: 'Sunset run along the coast',
    start: '2026-11-07T00:30:00Z',
    legs: [
      { kind: 'ground', at: 'KHHR', sec: 300 },
      { kind: 'fly', from: 'KHHR', to: 'KHHR', via: [[33.86, -118.42], [33.75, -118.3], [33.85, -118.32]], cruiseFt: 2500, kt: 105 },
      { kind: 'ground', at: 'KHHR', sec: 180 },
    ],
    caption: 'Palos Verdes at golden hour.',
    clubId: null,
    postVisibility: 'public',
  },
  {
    id: 'flt-sam-pattern',
    pilotId: 'acct-sam',
    title: 'Pattern work at Hawthorne',
    start: '2026-11-12T15:30:00Z',
    legs: [{ kind: 'ground', at: 'KHHR', sec: 300 }, hhrPattern(true), hhrPattern(false), { kind: 'ground', at: 'KHHR', sec: 180 }],
    caption: '',
    clubId: 'club-hfa',
    postVisibility: 'followers',
    instructor: { accountId: 'acct-dan', status: 'pending' },
  },
  {
    id: 'flt-jordan-tw',
    pilotId: 'acct-jordan',
    title: 'Taildragger hop to Santa Paula',
    start: '2026-11-07T17:00:00Z',
    legs: [
      { kind: 'ground', at: 'KCMA', sec: 360 },
      { kind: 'fly', from: 'KCMA', to: 'KSZP', cruiseFt: 2500, kt: 90 },
      { kind: 'ground', at: 'KSZP', sec: 1200 },
      { kind: 'fly', from: 'KSZP', to: 'KCMA', cruiseFt: 2500, kt: 90 },
      { kind: 'ground', at: 'KCMA', sec: 200 },
    ],
    caption: 'Wheel landings all day.',
    clubId: 'club-taildraggers',
    postVisibility: 'public',
    flewWith: [{ accountId: 'acct-kim', status: 'accepted' }],
  },
  {
    id: 'flt-kim-bigbear',
    pilotId: 'acct-kim',
    title: 'High country: Big Bear',
    start: '2026-11-05T16:30:00Z',
    legs: [
      { kind: 'ground', at: 'KCNO', sec: 420 },
      { kind: 'fly', from: 'KCNO', to: 'L35', via: [[34.15, -117.3]], cruiseFt: 9500, kt: 105 },
      { kind: 'ground', at: 'L35', sec: 300 },
    ],
    caption: 'Density altitude briefing first, then a gorgeous approach over the lake.',
    clubId: null,
    postVisibility: 'public',
  },
  {
    id: 'flt-marcus-ifr',
    pilotId: 'acct-marcus',
    title: 'Practice approaches at Oxnard',
    start: '2026-11-08T18:00:00Z',
    legs: [
      { kind: 'ground', at: 'KTOA', sec: 400 },
      { kind: 'fly', from: 'KTOA', to: 'KOXR', via: [[33.95, -118.6]], cruiseFt: 5000, kt: 115, touchAndGo: true },
      { kind: 'fly', from: 'KOXR', to: 'KTOA', via: [[33.95, -118.6]], cruiseFt: 4000, kt: 115 },
      { kind: 'ground', at: 'KTOA', sec: 200 },
    ],
    caption: 'Two ILS approaches under the hood.',
    clubId: null,
    postVisibility: 'public',
    instructor: { accountId: 'acct-priya', status: 'accepted' },
  },
  {
    id: 'flt-theo-mammoth',
    pilotId: 'acct-theo',
    title: 'Mammoth for the weekend',
    start: '2026-11-01T16:00:00Z',
    legs: [
      { kind: 'ground', at: 'KSMO', sec: 400 },
      { kind: 'fly', from: 'KSMO', to: 'KMMH', via: [[34.6, -118.1], [37.3, -118.4]], cruiseFt: 13500, kt: 150 },
      { kind: 'ground', at: 'KMMH', sec: 200 },
    ],
    caption: '',
    clubId: null,
    postVisibility: 'followers',
  },
]

const flights: Flight[] = FLIGHTS.map((s) => {
  const gpx = toGpx(synthesize(s.legs, airports as Airport[], s.start), s.title)
  const imported = importTrack(gpx, `${s.id}.gpx`, airports as Airport[])
  if (!imported.ok) throw new Error(`${s.id}: ${imported.error}`)
  const draft = {
    ...imported.draft,
    title: s.title,
    isSimulator: s.simulator !== undefined,
    source: { fileName: `${s.id}.gpx`, app: 'ForeFlight', gpsSource: s.simulator ?? null },
  }
  const choices: PostChoices = {
    caption: s.caption,
    routeVisibility: 'full',
    clubId: s.clubId,
    postVisibility: s.postVisibility,
    instructorId: null,
    flewWithIds: [],
  }
  const createdAt = new Date(Date.parse(s.start) + 3 * 3600_000).toISOString()
  const flight = createFlight(draft, choices, s.pilotId, s.id, createdAt)
  return { ...flight, instructor: s.instructor ?? null, flewWith: s.flewWith ?? [] }
})

writeFileSync(new URL('../src/data/seed/flights.json', import.meta.url), `${JSON.stringify(flights, null, 2)}\n`)
console.log(`Wrote ${flights.length} flights`)
