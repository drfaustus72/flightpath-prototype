import type { Airport } from './types'

const EARTH_RADIUS_NM = 3440.065
const toRad = (deg: number) => (deg * Math.PI) / 180

/** Great-circle distance in nautical miles. */
export function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const METERS_TO_FEET = 3.28084

export function nearestAirport(
  airports: readonly Airport[],
  lat: number,
  lon: number,
): { airport: Airport; distanceNm: number } | null {
  let best: { airport: Airport; distanceNm: number } | null = null
  for (const airport of airports) {
    const d = distanceNm(lat, lon, airport.lat, airport.lon)
    if (!best || d < best.distanceNm) best = { airport, distanceNm: d }
  }
  return best
}

/**
 * Douglas–Peucker simplification on lon/lat pairs, raising the tolerance until the
 * route fits `maxPoints`. Keeps first and last points.
 */
export function simplifyRoute(route: readonly [number, number][], maxPoints = 400): [number, number][] {
  if (route.length <= maxPoints) return route.map((p) => [p[0], p[1]])
  let tolerance = 0.0002
  let result = douglasPeucker(route, tolerance)
  while (result.length > maxPoints) {
    tolerance *= 1.6
    result = douglasPeucker(route, tolerance)
  }
  return result
}

function douglasPeucker(points: readonly [number, number][], tolerance: number): [number, number][] {
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length > 0) {
    const range = stack.pop()
    if (!range) break
    const [start, end] = range
    let maxDist = 0
    let index = -1
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i], points[start], points[end])
      if (d > maxDist) {
        maxDist = d
        index = i
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = 1
      stack.push([start, index], [index, end])
    }
  }
  const out: [number, number][] = []
  points.forEach((p, i) => {
    if (keep[i]) out.push([p[0], p[1]])
  })
  return out
}

function perpendicularDistance(
  p: readonly [number, number] | undefined,
  a: readonly [number, number] | undefined,
  b: readonly [number, number] | undefined,
): number {
  if (!p || !a || !b) return 0
  const [x, y] = p
  const [x1, y1] = a
  const [x2, y2] = b
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1)
  return Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / Math.hypot(dx, dy)
}
