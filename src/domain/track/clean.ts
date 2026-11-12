import { distanceNm } from '../geo'
import type { TrackPoint } from './parse'

/** Any jump implying more than this is a GPS or simulator glitch, not flight. */
export const SPIKE_SPEED_KT = 600

export interface CleanResult {
  points: TrackPoint[]
  spikesRemoved: number
  duplicatesRemoved: number
}

/**
 * Orders points by time, drops repeated timestamps and removes spikes:
 * points that imply an impossible speed from the last good point.
 * Untimed tracks are returned unchanged (we can't judge speed without time).
 */
export function cleanTrack(points: readonly TrackPoint[]): CleanResult {
  const timed = points.every((p) => p.t !== null)
  if (!timed) return { points: [...points], spikesRemoved: 0, duplicatesRemoved: 0 }

  const sorted = [...points].sort((a, b) => (a.t ?? 0) - (b.t ?? 0))
  const kept: TrackPoint[] = []
  let spikesRemoved = 0
  let duplicatesRemoved = 0

  for (const p of sorted) {
    const prev = kept.at(-1)
    if (!prev) {
      kept.push(p)
      continue
    }
    const dtSec = ((p.t ?? 0) - (prev.t ?? 0)) / 1000
    if (dtSec <= 0) {
      duplicatesRemoved++
      continue
    }
    const kt = distanceNm(prev.lat, prev.lon, p.lat, p.lon) / (dtSec / 3600)
    if (kt > SPIKE_SPEED_KT) {
      spikesRemoved++
      continue
    }
    kept.push(p)
  }
  return { points: kept, spikesRemoved, duplicatesRemoved }
}
