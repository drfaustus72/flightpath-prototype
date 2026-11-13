import { simplifyRoute } from '../geo'
import type { Airport, Flight } from '../types'
import { cleanTrack } from './clean'
import { analyzeLandings, type LandingAnalysis } from './landings'
import { parseTrackFile } from './parse'
import { computeStats } from './stats'

/** GPS sources that mean the "flight" was flown in a simulator. */
const SIMULATOR_SOURCE = /x-?plane|msfs|flight ?sim|prepar3d|p3d|aerofly|simulator|redbird|frasca/i

/** Everything about a flight that comes from the file; the pilot adds caption and sharing choices. */
export type FlightDraft = Omit<
  Flight,
  'id' | 'pilotId' | 'caption' | 'routeVisibility' | 'clubId' | 'simConfirmation' | 'postVisibility' | 'instructor' | 'flewWith' | 'createdAt'
> & {
  airportsVisited: string[]
}

export type ImportResult = { ok: true; draft: FlightDraft } | { ok: false; error: string }

export function isSimulatorSource(gpsSource: string | null): boolean {
  return gpsSource !== null && SIMULATOR_SOURCE.test(gpsSource)
}

export function importTrack(text: string, fileName: string, airports: readonly Airport[]): ImportResult {
  const parsed = parseTrackFile(text, fileName)
  if (!parsed.ok) return parsed

  const { meta } = parsed.track
  const cleaned = cleanTrack(parsed.track.points)
  if (cleaned.points.length < 2) {
    return { ok: false, error: `${fileName} has too few usable points to make a flight.` }
  }
  const stats = computeStats(cleaned.points)
  const landings = analyzeLandings(cleaned.points, airports)
  const isSimulator = isSimulatorSource(meta.gpsSource)

  const notes: string[] = []
  const glitches = cleaned.spikesRemoved
  if (glitches > 0) notes.push(`${glitches} GPS ${glitches === 1 ? 'glitch' : 'glitches'} removed from the track.`)
  if (isSimulator) notes.push(`Simulator session (${meta.gpsSource}). It's logged, but doesn't earn airport stamps.`)
  if (cleaned.points[0]?.t === null) notes.push('This file has no timestamps, so time and speed aren\'t shown.')
  const unknown = landings.landings.filter((l) => l.icao === null).length
  if (unknown > 0) notes.push(`${unknown} landing${unknown === 1 ? '' : 's'} away from any airport we know.`)
  if (meta.hasTailNumber) notes.push('The tail number in this file was not saved.')

  const route = simplifyRoute(cleaned.points.map((p) => [p.lon, p.lat] as [number, number]))
  const firstT = cleaned.points[0]?.t ?? null

  return {
    ok: true,
    draft: {
      title: flightTitle(meta.title, landings, fileName),
      startedAt: firstT === null ? null : new Date(firstT).toISOString(),
      source: { fileName, app: meta.app, gpsSource: meta.gpsSource },
      isSimulator,
      stats,
      departure: landings.departure,
      arrival: landings.arrival,
      landings: landings.landings,
      route,
      importNotes: notes,
      airportsVisited: landings.airportsVisited,
    },
  }
}

function flightTitle(fileTitle: string | null, l: LandingAnalysis, fileName: string): string {
  if (fileTitle && fileTitle.trim().length > 0) return fileTitle.trim().replace(/\s+-\s+/, ' → ')
  if (l.departure && l.arrival) {
    if (l.departure !== l.arrival) return `${l.departure} → ${l.arrival}`
    const tgs = l.landings.filter((x) => x.kind === 'touch_and_go').length
    return tgs > 0 ? `Pattern work at ${l.departure}` : `Local flight from ${l.departure}`
  }
  if (l.departure) return `Flight from ${l.departure}`
  return fileName.replace(/\.(gpx|kml)$/i, '')
}
