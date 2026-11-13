import { distanceNm } from './geo'
import { isVerifiedCfi } from './tiers'
import type { Account, Airport, Club, Mission, TrainingOffered, World } from './types'
import { isBlocked, isDiscoverable } from './visibility'

/**
 * Airport-anchored discovery (brief section 3): airport pages, the nearby directory and the map.
 * Never live location. Schools are always listed; verified CFIs when they keep their listing on;
 * pilots only when Discoverable, never minors, and never across a block. Paid tiers never buy
 * a higher position: lists are ordered by distance, then name.
 */

export const RADII_NM = [10, 25, 50, 100] as const
export type RadiusNm = (typeof RADII_NM)[number]

function airportOf(world: World, icao: string): Airport | undefined {
  return world.airports.find((a) => a.icao === icao)
}

function nmBetween(a: Airport, b: Airport): number {
  return distanceNm(a.lat, a.lon, b.lat, b.lon)
}

/** Airports a CFI is listed at: their home airport and the airports of schools they teach for. */
export function cfiAirports(world: World, cfi: Account): string[] {
  const staff = world.memberships
    .filter((m) => m.accountId === cfi.id && m.status === 'active' && m.roles.includes('staff_cfi'))
    .flatMap((m) => world.clubs.find((c) => c.id === m.clubId)?.homeAirport ?? [])
  return [...new Set([cfi.homeAirport, ...staff])]
}

/** Verified CFIs who keep their directory listing on, as seen by this viewer. */
export function listedCfis(world: World, viewerId: string): Account[] {
  return world.accounts.filter(
    (a) => isVerifiedCfi(a) && a.cfi?.listed === true && !a.isMinor && a.id !== viewerId && !isBlocked(world, viewerId, a.id),
  )
}

/** Discoverable adult pilots based at an airport (the brief's "pilots who call it home"). */
export function discoverablePilotsAt(world: World, viewerId: string, icao: string): Account[] {
  return world.accounts.filter((a) => a.homeAirport === icao && isDiscoverable(a) && !isBlocked(world, viewerId, a.id))
}

/** Which CFI ratings can teach a given kind of training. Unmatched kinds list schools only. */
const CFI_RATING_FOR: Partial<Record<TrainingOffered, 'CFI' | 'CFII' | 'MEI'>> = {
  private: 'CFI',
  commercial: 'CFI',
  cfi: 'CFI',
  instrument: 'CFII',
  multi_engine: 'MEI',
}

export interface NearbyClub {
  club: Club
  nm: number
}
export interface NearbyCfi {
  account: Account
  icao: string
  nm: number
}
export interface NearbyResult {
  clubs: NearbyClub[]
  cfis: NearbyCfi[]
}

export function nearby(world: World, viewerId: string, icao: string, radiusNm: number, training: TrainingOffered | null = null): NearbyResult {
  const from = airportOf(world, icao)
  if (!from) return { clubs: [], cfis: [] }
  const byDistance = <T extends { nm: number }>(name: (x: T) => string) => (a: T, b: T) => a.nm - b.nm || name(a).localeCompare(name(b))

  const clubs = world.clubs.flatMap((club) => {
    if (training && !club.trainingOffered.includes(training)) return []
    const at = airportOf(world, club.homeAirport)
    if (!at) return []
    const nm = nmBetween(from, at)
    return nm <= radiusNm ? [{ club, nm }] : []
  })

  const rating = training ? CFI_RATING_FOR[training] : undefined
  const cfis = listedCfis(world, viewerId).flatMap((account) => {
    if (training && (!rating || !account.cfi?.ratings.includes(rating))) return []
    const options = cfiAirports(world, account).flatMap((code) => {
      const at = airportOf(world, code)
      return at ? [{ icao: code, nm: nmBetween(from, at) }] : []
    })
    const closest = options.sort((a, b) => a.nm - b.nm)[0]
    return closest && closest.nm <= radiusNm ? [{ account, ...closest }] : []
  })

  return {
    clubs: clubs.sort(byDistance((x) => x.club.name)),
    cfis: cfis.sort(byDistance((x) => x.account.displayName)),
  }
}

export interface AirportPage {
  airport: Airport
  clubs: Club[]
  cfis: Account[]
  pilots: Account[]
  missions: Mission[]
}

export function airportPage(world: World, viewerId: string, icao: string): AirportPage | null {
  const airport = airportOf(world, icao.toUpperCase())
  if (!airport) return null
  const byName = (a: { name?: string; displayName?: string }, b: { name?: string; displayName?: string }) =>
    (a.name ?? a.displayName ?? '').localeCompare(b.name ?? b.displayName ?? '')
  return {
    airport,
    clubs: world.clubs.filter((c) => c.homeAirport === airport.icao).sort(byName),
    cfis: listedCfis(world, viewerId)
      .filter((a) => cfiAirports(world, a).includes(airport.icao))
      .sort(byName),
    pilots: discoverablePilotsAt(world, viewerId, airport.icao)
      .filter((a) => !isVerifiedCfi(a))
      .sort(byName),
    missions: world.missions.filter((m) => m.requirements.landAtAny?.includes(airport.icao)),
  }
}

export interface MapPoint {
  airport: Airport
  clubs: Club[]
  cfis: number
  /** Pilots are only ever a count on the map, never individual pins. */
  pilots: number
}

export function mapPoints(world: World, viewerId: string): MapPoint[] {
  const cfis = listedCfis(world, viewerId)
  return world.airports.flatMap((airport) => {
    const clubs = world.clubs.filter((c) => c.homeAirport === airport.icao)
    const cfiCount = cfis.filter((a) => cfiAirports(world, a).includes(airport.icao)).length
    const pilots = discoverablePilotsAt(world, viewerId, airport.icao).length
    return clubs.length + cfiCount + pilots > 0 ? [{ airport, clubs, cfis: cfiCount, pilots }] : []
  })
}

/** An airport identifier search match, for linking search results to airport pages. */
export function airportForQuery(world: World, raw: string): Airport | undefined {
  const q = raw.trim().toUpperCase()
  return q.length >= 3 ? airportOf(world, q) : undefined
}
