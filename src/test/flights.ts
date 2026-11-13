import { createFlight } from '../domain/flights'
import { importTrack } from '../domain/track/importTrack'
import { type Leg, synthesize, toGpx } from '../domain/track/synth'
import type { Flight, World } from '../domain/types'

let n = 0

/** Builds a flight from synthetic legs through the real import pipeline. */
export function flyLegs(
  world: World,
  legs: Leg[],
  start: string,
  opts: { pilotId: string; clubId?: string | null; sim?: boolean; instructorId?: string | null },
): Flight {
  const r = importTrack(toGpx(synthesize(legs, world.airports, start), 'Test'), 't.gpx', world.airports)
  if (!r.ok) throw new Error(r.error)
  const draft = { ...r.draft, isSimulator: opts.sim ?? false }
  const f = createFlight(
    draft,
    { caption: '', routeVisibility: 'full', clubId: opts.clubId ?? null, postVisibility: 'public', instructorId: opts.instructorId ?? null, flewWithIds: [] },
    opts.pilotId,
    `test-flt-${++n}`,
    start,
  )
  return f
}

/** Out and back with a full stop at `to`. */
export const outAndBack = (from: string, to: string): Leg[] => [
  { kind: 'ground', at: from, sec: 120 },
  { kind: 'fly', from, to, cruiseFt: 4500, kt: 110 },
  { kind: 'ground', at: to, sec: 300 },
  { kind: 'fly', from: to, to: from, cruiseFt: 4500, kt: 110 },
  { kind: 'ground', at: from, sec: 120 },
]
