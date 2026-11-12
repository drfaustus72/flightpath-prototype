import { METERS_TO_FEET } from '../geo'

export interface TrackPoint {
  /** Epoch milliseconds, or null when the file has no timestamps. */
  t: number | null
  lat: number
  lon: number
  /** Feet MSL, or null when the file has no altitude. */
  altFt: number | null
}

export interface TrackMeta {
  format: 'kml-track' | 'kml-line' | 'gpx'
  title: string | null
  app: string | null
  gpsSource: string | null
  /** Read so we can tell the user we ignore it; never stored or shown. */
  hasTailNumber: boolean
}

export interface RawTrack {
  points: TrackPoint[]
  meta: TrackMeta
}

export type ParseResult = { ok: true; track: RawTrack } | { ok: false; error: string }

export const MAX_FILE_BYTES = 10 * 1024 * 1024

const KML_NS = 'http://www.opengis.net/kml/2.2'
const GX_NS = 'http://www.google.com/kml/ext/2.2'

/** Parses a GPX or KML track exported from ForeFlight, Garmin Pilot, phones, etc. */
export function parseTrackFile(text: string, fileName: string): ParseResult {
  if (text.length > MAX_FILE_BYTES) return { ok: false, error: 'This file is larger than 10 MB. Export a single flight and try again.' }
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return { ok: false, error: `${fileName} isn't a readable GPX or KML file. Export the track again and retry.` }
  }
  const root = doc.documentElement.localName
  const parsed = root === 'gpx' ? parseGpx(doc) : root === 'kml' ? parseKml(doc) : null
  if (!parsed) return { ok: false, error: `${fileName} isn't a GPX or KML track. Flightpath reads .gpx and .kml files.` }
  const points = parsed.points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180)
  if (points.length < 2) return { ok: false, error: `${fileName} doesn't contain a flight track. Check that you exported the track log, not a route or flight plan.` }
  return { ok: true, track: { ...parsed, points } }
}

function parseTime(s: string | null | undefined): number | null {
  if (!s) return null
  const t = Date.parse(s.trim())
  return Number.isNaN(t) ? null : t
}

function parseKml(doc: Document): RawTrack | null {
  const meta = readKmlMetadata(doc)
  // ForeFlight and Google Earth timestamped tracks: <gx:Track> with paired <when>/<gx:coord>.
  const tracks = Array.from(doc.getElementsByTagNameNS(GX_NS, 'Track'))
  if (tracks.length > 0) {
    const points: TrackPoint[] = []
    for (const track of tracks) {
      const whens = Array.from(track.getElementsByTagNameNS(KML_NS, 'when'))
      const coords = Array.from(track.getElementsByTagNameNS(GX_NS, 'coord'))
      coords.forEach((el, i) => {
        const [lon, lat, altM] = (el.textContent ?? '').trim().split(/\s+/).map(Number)
        if (lon === undefined || lat === undefined) return
        points.push({
          t: parseTime(whens[i]?.textContent),
          lat,
          lon,
          altFt: altM === undefined || Number.isNaN(altM) ? null : altM * METERS_TO_FEET,
        })
      })
    }
    return { points, meta: { ...meta, format: 'kml-track' } }
  }
  // Plain KML: <LineString><coordinates>lon,lat,alt lon,lat,alt</coordinates>. No timestamps.
  const lines = Array.from(doc.getElementsByTagNameNS(KML_NS, 'LineString'))
  if (lines.length > 0) {
    const points: TrackPoint[] = []
    for (const line of lines) {
      const text = line.getElementsByTagNameNS(KML_NS, 'coordinates')[0]?.textContent ?? ''
      for (const tuple of text.trim().split(/\s+/)) {
        const [lon, lat, altM] = tuple.split(',').map(Number)
        if (lon === undefined || lat === undefined) continue
        points.push({ t: null, lat, lon, altFt: altM === undefined || Number.isNaN(altM) ? null : altM * METERS_TO_FEET })
      }
    }
    return { points, meta: { ...meta, format: 'kml-line' } }
  }
  return { points: [], meta: { ...meta, format: 'kml-line' } }
}

function readKmlMetadata(doc: Document): Omit<TrackMeta, 'format'> {
  const data = new Map<string, string>()
  for (const el of Array.from(doc.getElementsByTagNameNS(KML_NS, 'Data'))) {
    const name = el.getAttribute('name')
    const value = el.getElementsByTagNameNS(KML_NS, 'value')[0]?.textContent?.trim()
    if (name && value) data.set(name, value)
  }
  return {
    title: data.get('flightTitle') ?? null,
    app: data.get('source') ?? null,
    gpsSource: data.get('GPSModelName') ?? null,
    hasTailNumber: data.has('tailNumber'),
  }
}

function parseGpx(doc: Document): RawTrack {
  const pick = (el: Element, name: string) => el.getElementsByTagName(name)[0]?.textContent ?? null
  let pts = Array.from(doc.getElementsByTagName('trkpt'))
  if (pts.length === 0) pts = Array.from(doc.getElementsByTagName('rtept'))
  const points = pts.map((el) => {
    const ele = pick(el, 'ele')
    return {
      t: parseTime(pick(el, 'time')),
      lat: Number(el.getAttribute('lat')),
      lon: Number(el.getAttribute('lon')),
      altFt: ele === null || ele.trim() === '' ? null : Number(ele) * METERS_TO_FEET,
    }
  })
  const metaName = doc.getElementsByTagName('metadata')[0]?.getElementsByTagName('name')[0]?.textContent ?? null
  const trkName = doc.getElementsByTagName('trk')[0]?.getElementsByTagName('name')[0]?.textContent ?? null
  const creator = doc.documentElement.getAttribute('creator')
  return {
    points,
    meta: { format: 'gpx', title: (trkName ?? metaName)?.trim() || null, app: creator, gpsSource: null, hasTailNumber: false },
  }
}
