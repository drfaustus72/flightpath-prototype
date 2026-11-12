import { distanceNm } from './geo'
import type { Account, Airport, Flight, World } from './types'

/**
 * Recognition derived from a pilot's flights and profile: airport stamps with takeoff and
 * landing counts, states and countries, and "candy" badges. Nothing here is stored, so badge
 * definitions can change without migrating data. Things someone must verify (training
 * milestones, missions, and XP from them) are stored separately as achievements.
 *
 * Simulator sessions never earn stamps, airport counts or flight badges.
 */

export interface AirportRecord {
  icao: string
  name: string
  state: string
  country: string
  landings: number
  takeoffs: number
  firstFlightId: string
}

export type BadgeFamily = 'activity' | 'collection' | 'hours'
/** tracked: from logged flights · self_reported / logbook_verified: from the hours the pilot entered. */
export type BadgeSource = 'tracked' | 'self_reported' | 'logbook_verified'

export interface Badge {
  code: string
  title: string
  family: BadgeFamily
  source: BadgeSource
  /** The flight that earned it, when a flight did. */
  flightId: string | null
}

export interface Recognition {
  airports: AirportRecord[]
  states: string[]
  countries: string[]
  badges: Badge[]
  flights: number
  simSessions: number
}

/** Flights in the order they were flown. */
export function flightsInOrder(flights: readonly Flight[]): Flight[] {
  return [...flights].sort((a, b) => (a.startedAt ?? a.createdAt).localeCompare(b.startedAt ?? b.createdAt))
}

/** Takeoffs and landings a single flight adds at each known airport. */
export function airportEvents(flight: Flight): Map<string, { landings: number; takeoffs: number }> {
  const events = new Map<string, { landings: number; takeoffs: number }>()
  const bump = (icao: string | null, key: 'landings' | 'takeoffs') => {
    if (!icao) return
    const e = events.get(icao) ?? { landings: 0, takeoffs: 0 }
    e[key]++
    events.set(icao, e)
  }
  bump(flight.departure, 'takeoffs')
  const fullStops = flight.landings.filter((l) => l.kind === 'full_stop')
  const lastFullStop = fullStops.at(-1)
  for (const l of flight.landings) {
    bump(l.icao, 'landings')
    // A touch-and-go is also a takeoff; so is a full stop followed by another departure.
    const endsHere = l === lastFullStop && flight.arrival !== null
    if (l.kind === 'touch_and_go' || !endsHere) bump(l.icao, 'takeoffs')
  }
  return events
}

const FLIGHT_COUNTS = [10, 25, 50, 100, 250]
const AIRPORT_COUNTS = [5, 10, 25, 50]
const STATE_COUNTS = [3, 5, 10]
/** Includes the milestones pilots care about: 40 (private), 250 (commercial), 1,500 (ATP). Recognition only. */
export const HOUR_MILESTONES = [10, 25, 40, 50, 100, 150, 200, 250, 500, 1000, 1500, 2500, 5000]
/** FAA cross-country distance, used here only for a recognition badge. */
const CROSS_COUNTRY_NM = 50

export function recognitionFor(world: World, pilotId: string): Recognition {
  const account = world.accounts.find((a) => a.id === pilotId)
  const airportsByIcao = new Map(world.airports.map((a) => [a.icao, a]))
  const records = new Map<string, AirportRecord>()
  const badges: Badge[] = []
  const has = new Set<string>()
  const award = (code: string, title: string, family: BadgeFamily, source: BadgeSource, flightId: string | null) => {
    if (has.has(code)) return
    has.add(code)
    badges.push({ code, title, family, source, flightId })
  }

  let flights = 0
  let simSessions = 0
  for (const flight of flightsInOrder(world.flights.filter((f) => f.pilotId === pilotId))) {
    if (flight.isSimulator) {
      simSessions++
      award('first_sim', 'First sim session', 'activity', 'tracked', flight.id)
      continue
    }
    flights++
    award('first_flight', 'First flight logged', 'activity', 'tracked', flight.id)
    for (const n of FLIGHT_COUNTS) if (flights === n) award(`flights_${n}`, `${n} flights logged`, 'activity', 'tracked', flight.id)
    if (flight.landings.some((l) => l.kind === 'touch_and_go')) {
      award('first_touch_and_go', 'First touch-and-go', 'activity', 'tracked', flight.id)
    }
    if (isCrossCountry(flight, airportsByIcao)) {
      award('first_cross_country', 'First 50 nm cross-country', 'activity', 'tracked', flight.id)
    }

    for (const [icao, e] of airportEvents(flight)) {
      const airport = airportsByIcao.get(icao)
      if (!airport) continue
      const rec = records.get(icao)
      if (rec) {
        rec.landings += e.landings
        rec.takeoffs += e.takeoffs
      } else {
        records.set(icao, { icao, name: airport.name, state: airport.state, country: airport.country, ...e, firstFlightId: flight.id })
      }
    }
    for (const n of AIRPORT_COUNTS) if (records.size >= n) award(`airports_${n}`, `${n} airports`, 'collection', 'tracked', flight.id)
    const stateCount = new Set([...records.values()].map((r) => `${r.country}-${r.state}`)).size
    for (const n of STATE_COUNTS) if (stateCount >= n) award(`states_${n}`, `${n} states`, 'collection', 'tracked', flight.id)
  }

  if (account) {
    for (const n of HOUR_MILESTONES) {
      if (account.totalHours >= n) award(`hours_${n}`, `${n.toLocaleString('en-US')} hours`, 'hours', account.hoursSource, null)
    }
  }

  const airports = [...records.values()]
  return {
    airports,
    states: [...new Set(airports.map((a) => `${a.state}`))],
    countries: [...new Set(airports.map((a) => a.country))],
    badges,
    flights,
    simSessions,
  }
}

function isCrossCountry(flight: Flight, airports: Map<string, Airport>): boolean {
  const dep = flight.departure ? airports.get(flight.departure) : undefined
  if (!dep) return false
  return flight.landings.some((l) => {
    const a = l.icao ? airports.get(l.icao) : undefined
    return a !== undefined && distanceNm(dep.lat, dep.lon, a.lat, a.lon) >= CROSS_COUNTRY_NM
  })
}

/** What a newly logged flight added: compare recognition before and after. */
export function newlyEarned(before: Recognition, after: Recognition): { airports: AirportRecord[]; badges: Badge[] } {
  const hadAirport = new Set(before.airports.map((a) => a.icao))
  const hadBadge = new Set(before.badges.map((b) => b.code))
  return {
    airports: after.airports.filter((a) => !hadAirport.has(a.icao)),
    badges: after.badges.filter((b) => !hadBadge.has(b.code)),
  }
}

const DAY_MS = 86_400_000

/** Landings in logged real flights within the last `days` days. Information only, not a currency determination. */
export function landingsWithin(world: World, pilotId: string, days: number, now: Date): number {
  const since = now.getTime() - days * DAY_MS
  let count = 0
  for (const f of world.flights) {
    if (f.pilotId !== pilotId || f.isSimulator) continue
    for (const l of f.landings) {
      const at = Date.parse(l.at ?? f.startedAt ?? f.createdAt)
      if (at >= since && at <= now.getTime()) count++
    }
  }
  return count
}

export interface FlightReviewStatus {
  status: 'unknown' | 'current' | 'due_soon' | 'overdue'
  lastOn: string | null
  /** Last day of the 24th calendar month after the review (14 CFR 61.56), as YYYY-MM-DD. */
  dueBy: string | null
  daysLeft: number | null
}

export const FLIGHT_REVIEW_REMINDER_DAYS = 90

export function flightReviewStatus(account: Pick<Account, 'flightReviewOn'>, now: Date): FlightReviewStatus {
  if (!account.flightReviewOn) return { status: 'unknown', lastOn: null, dueBy: null, daysLeft: null }
  const [y, m] = account.flightReviewOn.split('-').map(Number)
  if (y === undefined || m === undefined) return { status: 'unknown', lastOn: account.flightReviewOn, dueBy: null, daysLeft: null }
  // Day 0 of the following month = last day of the 24th calendar month after the review month.
  const due = new Date(Date.UTC(y + 2, m, 0))
  const dueBy = due.toISOString().slice(0, 10)
  const endOfDue = due.getTime() + DAY_MS - 1
  const daysLeft = Math.ceil((endOfDue - now.getTime()) / DAY_MS)
  const status = daysLeft < 0 ? 'overdue' : daysLeft <= FLIGHT_REVIEW_REMINDER_DAYS ? 'due_soon' : 'current'
  return { status, lastOn: account.flightReviewOn, dueBy, daysLeft }
}
