import { METERS_TO_FEET, distanceNm } from '../geo'
import type { Airport } from '../types'
import type { TrackPoint } from './parse'

/**
 * Generates realistic fictional tracks for demo samples and tests:
 * taxi, climb, cruise, descent, landings and touch-and-goes between real airports.
 */
export type Leg =
  | { kind: 'ground'; at: string; sec: number }
  | {
      kind: 'fly'
      from: string
      to: string
      /** Optional turn points as [lat, lon]. */
      via?: [number, number][]
      cruiseFt: number
      kt: number
      /** Keep flying after reaching `to` (touch-and-go) instead of stopping. */
      touchAndGo?: boolean
    }

const STEP_SEC = 4

export function synthesize(legs: readonly Leg[], airports: readonly Airport[], startIso: string): TrackPoint[] {
  const byIcao = (code: string) => {
    const a = airports.find((x) => x.icao === code)
    if (!a) throw new Error(`synth: unknown airport ${code}`)
    return a
  }
  const points: TrackPoint[] = []
  let t = Date.parse(startIso)

  for (const leg of legs) {
    if (leg.kind === 'ground') {
      const a = byIcao(leg.at)
      // Taxi slowly along a short line on the field.
      for (let s = 0; s <= leg.sec; s += STEP_SEC) {
        const frac = s / Math.max(leg.sec, 1)
        points.push({ t, lat: a.lat + 0.002 * Math.sin(frac * Math.PI), lon: a.lon + 0.003 * frac, altFt: a.elevationFt })
        t += STEP_SEC * 1000
      }
      continue
    }
    const from = byIcao(leg.from)
    const to = byIcao(leg.to)
    const path: [number, number][] = [[from.lat, from.lon], ...(leg.via ?? []), [to.lat, to.lon]]
    const segLen = path.slice(1).map((p, i) => {
      const prev = path[i] ?? p
      return distanceNm(prev[0], prev[1], p[0], p[1])
    })
    const total = segLen.reduce((a, b) => a + b, 0)
    const totalSec = (total / leg.kt) * 3600
    for (let s = 0; s <= totalSec; s += STEP_SEC) {
      const along = (s / totalSec) * total
      const [lat, lon] = pointAlong(path, segLen, along)
      const climb = from.elevationFt + (700 / 60) * s
      const descend = to.elevationFt + (500 / 60) * (totalSec - s)
      const altFt = Math.min(leg.cruiseFt, climb, descend)
      points.push({ t, lat, lon, altFt })
      t += STEP_SEC * 1000
    }
  }
  return points
}

function pointAlong(path: readonly [number, number][], segLen: readonly number[], along: number): [number, number] {
  let remaining = along
  for (let i = 0; i < segLen.length; i++) {
    const len = segLen[i] ?? 0
    const a = path[i]
    const b = path[i + 1]
    if (!a || !b) break
    if (remaining <= len || i === segLen.length - 1) {
      const f = len === 0 ? 0 : Math.min(1, remaining / len)
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
    }
    remaining -= len
  }
  const end = path.at(-1) ?? [0, 0]
  return [end[0], end[1]]
}

/** Serializes points as GPX so samples go through the same import path as uploads. */
export function toGpx(points: readonly TrackPoint[], name: string): string {
  const pts = points
    .map((p) => {
      const ele = p.altFt === null ? '' : `<ele>${(p.altFt / METERS_TO_FEET).toFixed(1)}</ele>`
      const time = p.t === null ? '' : `<time>${new Date(p.t).toISOString()}</time>`
      return `<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${ele}${time}</trkpt>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Flightpath sample" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${name}</name><trkseg>${pts}</trkseg></trk></gpx>`
}
