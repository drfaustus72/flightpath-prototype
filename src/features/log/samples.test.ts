import { describe, expect, it } from 'vitest'
import { seedResult } from '../../data/seed'
import { importTrack } from '../../domain/track/importTrack'
import { synthesize, toGpx } from '../../domain/track/synth'
import { SAMPLES } from './samples'

const airports = seedResult.ok ? seedResult.world.airports : []

const expected: Record<string, { visited: string[]; landings: string[] }> = {
  catalina: { visited: ['KHHR', 'KAVX'], landings: ['full_stop:KAVX', 'full_stop:KHHR'] },
  pattern: { visited: ['KTOA'], landings: ['touch_and_go:KTOA', 'touch_and_go:KTOA', 'touch_and_go:KTOA', 'full_stop:KTOA'] },
  'santa-barbara': { visited: ['KHHR', 'KSBA'], landings: ['full_stop:KSBA'] },
  'big-bear': { visited: ['KCNO', 'L35'], landings: ['full_stop:L35'] },
}

describe('synthetic samples', () => {
  for (const sample of SAMPLES) {
    if (sample.kind !== 'synthetic') continue
    it(`${sample.name} imports with the expected landings`, () => {
      const gpx = toGpx(synthesize(sample.legs, airports, sample.start), sample.name)
      const r = importTrack(gpx, `${sample.id}.gpx`, airports)
      if (!r.ok) throw new Error(r.error)
      expect(r.draft.airportsVisited).toEqual(expected[sample.id]?.visited)
      expect(r.draft.landings.map((l) => `${l.kind}:${l.icao}`)).toEqual(expected[sample.id]?.landings)
    })
  }
})
