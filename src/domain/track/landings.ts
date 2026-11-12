import { nearestAirport } from '../geo'
import type { Airport, Landing } from '../types'
import type { TrackPoint } from './parse'
import { GROUND_SPEED_KT, groundspeeds } from './stats'

/** A stop or touch-and-go counts at an airport within this distance of its reference point. */
export const AIRPORT_RADIUS_NM = 1.5
/** On the ground means slow AND within this height of the nearest field's elevation. */
const GROUND_MAX_AGL_FT = 300
/** A touch-and-go is a low pass this close to field elevation… */
const TOUCH_AND_GO_MAX_AGL_FT = 150
/** …after having climbed at least this high since the last event, so takeoff roll doesn't count. */
const TOUCH_AND_GO_MIN_CLIMB_FT = 500
/** A ground run must last this long, so slow flight or a sim pause isn't a landing. */
const MIN_GROUND_RUN_SEC = 20

export interface LandingAnalysis {
  departure: string | null
  arrival: string | null
  landings: Landing[]
  /** Unique airports the pilot departed from or landed at, in order of first visit. */
  airportsVisited: string[]
}

const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString())

function airportNear(airports: readonly Airport[], p: TrackPoint): Airport | null {
  const hit = nearestAirport(airports, p.lat, p.lon)
  return hit && hit.distanceNm <= AIRPORT_RADIUS_NM ? hit.airport : null
}

function aglNear(airports: readonly Airport[], p: TrackPoint, withinNm: number): number | null {
  if (p.altFt === null) return null
  const hit = nearestAirport(airports, p.lat, p.lon)
  if (!hit || hit.distanceNm > withinNm) return null
  return p.altFt - hit.airport.elevationFt
}

export function analyzeLandings(points: readonly TrackPoint[], airports: readonly Airport[]): LandingAnalysis {
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last) return { departure: null, arrival: null, landings: [], airportsVisited: [] }

  // Untimed tracks: all we can say is where the line starts and ends.
  if (first.t === null) {
    const dep = airportNear(airports, first)
    const arr = airportNear(airports, last)
    const landings: Landing[] = arr ? [{ icao: arr.icao, kind: 'full_stop', lon: last.lon, lat: last.lat, at: null }] : []
    return finish(dep?.icao ?? null, arr?.icao ?? null, landings)
  }

  const speeds = groundspeeds(points)
  const onGround = points.map((p, i) => {
    const s = speeds[i]
    if (s === null || s === undefined || s >= GROUND_SPEED_KT) return false
    const agl = aglNear(airports, p, 5)
    return agl === null || agl <= GROUND_MAX_AGL_FT
  })

  // Group consecutive ground points into runs long enough to be real.
  const runs: { start: number; end: number }[] = []
  for (let i = 0; i < points.length; i++) {
    if (!onGround[i]) continue
    let j = i
    while (j + 1 < points.length && onGround[j + 1]) j++
    const t0 = points[i]?.t ?? 0
    const t1 = points[j]?.t ?? 0
    const isEdge = i === 0 || j === points.length - 1
    if ((t1 - t0) / 1000 >= MIN_GROUND_RUN_SEC || isEdge) runs.push({ start: i, end: j })
    i = j
  }

  const startsOnGround = runs[0]?.start === 0
  const endsOnGround = runs.at(-1)?.end === points.length - 1
  const departure = startsOnGround && runs[0] ? airportNear(airports, points[runs[0].end] ?? first) : null

  const landings: Landing[] = []
  const fullStops = startsOnGround ? runs.slice(1) : runs
  for (const run of fullStops) {
    const touchdown = points[run.start]
    if (!touchdown) continue
    landings.push({
      icao: airportNear(airports, touchdown)?.icao ?? null,
      kind: 'full_stop',
      lon: touchdown.lon,
      lat: touchdown.lat,
      at: iso(touchdown.t),
    })
  }

  // Touch-and-goes: low passes over a field between ground runs, after a real climb.
  let climbedSinceEvent = 0
  let lowPassAt: string | null = null
  const runAt = new Set(runs.flatMap((r) => Array.from({ length: r.end - r.start + 1 }, (_, k) => r.start + k)))
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (!p) continue
    if (runAt.has(i)) {
      climbedSinceEvent = 0
      lowPassAt = null
      continue
    }
    const agl = aglNear(airports, p, AIRPORT_RADIUS_NM)
    const field = airportNear(airports, p)
    const anyAgl = aglNear(airports, p, 50)
    if (anyAgl !== null) climbedSinceEvent = Math.max(climbedSinceEvent, anyAgl)
    if (field && agl !== null && agl <= TOUCH_AND_GO_MAX_AGL_FT && climbedSinceEvent >= TOUCH_AND_GO_MIN_CLIMB_FT) {
      if (lowPassAt !== field.icao) {
        landings.push({ icao: field.icao, kind: 'touch_and_go', lon: p.lon, lat: p.lat, at: iso(p.t) })
        lowPassAt = field.icao
        climbedSinceEvent = 0
      }
    } else if (agl === null || agl > TOUCH_AND_GO_MAX_AGL_FT * 2) {
      lowPassAt = null
    }
  }

  // A low pass immediately followed by a full stop at the same field is the landing itself.
  const cleaned = landings
    .filter((l, _idx, all) => {
      if (l.kind !== 'touch_and_go' || !l.at) return true
      const tl = Date.parse(l.at)
      return !all.some(
        (o) => o.kind === 'full_stop' && o.icao === l.icao && o.at && Date.parse(o.at) - tl >= 0 && Date.parse(o.at) - tl < 180_000,
      )
    })
    .sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''))

  const arrival = endsOnGround ? (cleaned.filter((l) => l.kind === 'full_stop').at(-1)?.icao ?? null) : null
  return finish(departure?.icao ?? null, arrival, cleaned)
}

function finish(departure: string | null, arrival: string | null, landings: Landing[]): LandingAnalysis {
  const visited: string[] = []
  for (const code of [departure, ...landings.map((l) => l.icao)]) {
    if (code && !visited.includes(code)) visited.push(code)
  }
  return { departure, arrival, landings, airportsVisited: visited }
}
