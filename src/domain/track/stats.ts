import { distanceNm } from '../geo'
import type { FlightStats } from '../types'
import type { TrackPoint } from './parse'

/** Groundspeed below this counts as on the ground (taxi, run-up, parked). */
export const GROUND_SPEED_KT = 40

/**
 * Groundspeed at each point, averaged over neighbours at least `windowSec` apart,
 * so single-sample GPS jitter doesn't register as speed. Null for untimed tracks.
 */
export function groundspeeds(points: readonly TrackPoint[], windowSec = 6): (number | null)[] {
  return points.map((p, i) => {
    if (p.t === null) return null
    let a = i
    let b = i
    while (a > 0 && (p.t - (points[a]?.t ?? p.t)) / 1000 < windowSec / 2) a--
    while (b < points.length - 1 && ((points[b]?.t ?? p.t) - p.t) / 1000 < windowSec / 2) b++
    const pa = points[a]
    const pb = points[b]
    if (!pa || !pb || pa.t === null || pb.t === null || pb.t === pa.t) return null
    return distanceNm(pa.lat, pa.lon, pb.lat, pb.lon) / ((pb.t - pa.t) / 3_600_000)
  })
}

export function computeStats(points: readonly TrackPoint[]): FlightStats {
  let dist = 0
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (a && b) dist += distanceNm(a.lat, a.lon, b.lat, b.lon)
  }

  const first = points[0]
  const last = points.at(-1)
  const durationSec =
    first?.t != null && last?.t != null ? Math.round((last.t - first.t) / 1000) : null

  const speeds = groundspeeds(points)
  const known = speeds.filter((s): s is number => s !== null)
  const maxGroundspeedKt = known.length > 0 ? Math.round(Math.max(...known)) : null

  let airborneSec: number | null = null
  if (durationSec !== null) {
    airborneSec = 0
    for (let i = 1; i < points.length; i++) {
      const s = speeds[i]
      const a = points[i - 1]
      const b = points[i]
      if (s !== null && s !== undefined && s >= GROUND_SPEED_KT && a?.t != null && b?.t != null) {
        airborneSec += (b.t - a.t) / 1000
      }
    }
    airborneSec = Math.round(airborneSec)
  }

  const alts = points.map((p) => p.altFt).filter((a): a is number => a !== null)
  return {
    distanceNm: Math.round(dist * 10) / 10,
    durationSec,
    airborneSec,
    maxAltitudeFt: alts.length > 0 ? Math.round(Math.max(...alts)) : null,
    maxGroundspeedKt,
  }
}
