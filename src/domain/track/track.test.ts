import { describe, expect, it } from 'vitest'
import { cleanTrack } from './clean'
import { parseTrackFile } from './parse'
import { computeStats } from './stats'
import foreflightKml from '../../test/fixtures/foreflight-kemt-kpoc-sim.kml?raw'


function parseOk(text: string, name = 'test.gpx') {
  const r = parseTrackFile(text, name)
  if (!r.ok) throw new Error(r.error)
  return r.track
}

describe('ForeFlight KML (real export)', () => {
  const track = parseOk(foreflightKml, 'tracklog.kml')

  it('reads every timestamped point and the metadata', () => {
    expect(track.meta.format).toBe('kml-track')
    expect(track.points).toHaveLength(612)
    expect(track.points.every((p) => p.t !== null && p.altFt !== null)).toBe(true)
    expect(track.meta.title).toBe('KEMT - KPOC')
    expect(track.meta.app).toBe('ForeFlight Web')
    expect(track.meta.gpsSource).toBe('X-Plane')
    expect(track.meta.hasTailNumber).toBe(false)
  })

  it('removes the three position spikes', () => {
    const cleaned = cleanTrack(track.points)
    expect(cleaned.spikesRemoved).toBe(3)
    expect(cleaned.points).toHaveLength(609)
  })

  it('computes plausible stats once cleaned', () => {
    const stats = computeStats(cleanTrack(track.points).points)
    expect(stats.distanceNm).toBeGreaterThan(38)
    expect(stats.distanceNm).toBeLessThan(43)
    expect(stats.durationSec).toBe(2092)
    expect(stats.maxAltitudeFt).toBeGreaterThan(6000)
    expect(stats.maxAltitudeFt).toBeLessThan(6400)
    expect(stats.maxGroundspeedKt).toBeLessThan(160)
    expect(stats.airborneSec).toBeGreaterThan(20 * 60)
  })

  it('would have reported ~231 nm without spike removal', () => {
    expect(computeStats(track.points).distanceNm).toBeGreaterThan(200)
  })
})

const gpx = (pts: string, extra = '') =>
  `<?xml version="1.0"?><gpx version="1.1" creator="TestApp" xmlns="http://www.topografix.com/GPX/1/1">${extra}<trk><name>Pattern work</name><trkseg>${pts}</trkseg></trk></gpx>`

describe('GPX', () => {
  it('reads points, elevation (meters → feet), time and name', () => {
    const track = parseOk(
      gpx(
        '<trkpt lat="33.9228" lon="-118.335"><ele>20</ele><time>2026-11-01T17:00:00Z</time></trkpt>' +
          '<trkpt lat="33.93" lon="-118.33"><ele>300</ele><time>2026-11-01T17:01:00Z</time></trkpt>',
      ),
    )
    expect(track.meta).toMatchObject({ format: 'gpx', title: 'Pattern work', app: 'TestApp' })
    expect(track.points[0]?.altFt).toBeCloseTo(65.6, 1)
    expect(track.points[1]?.t).toBe(Date.parse('2026-11-01T17:01:00Z'))
  })
})

describe('KML LineString (no timestamps)', () => {
  it('reads coordinates without times; cleaning leaves them alone', () => {
    const kml = `<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><LineString><coordinates>
      -118.335,33.9228,20 -118.40,33.60,1000 -118.416,33.4049,490</coordinates></LineString></Placemark></kml>`
    const track = parseOk(kml, 'route.kml')
    expect(track.meta.format).toBe('kml-line')
    expect(track.points).toHaveLength(3)
    expect(track.points.every((p) => p.t === null)).toBe(true)
    expect(cleanTrack(track.points).points).toHaveLength(3)
    expect(computeStats(track.points).durationSec).toBeNull()
  })
})

describe('errors', () => {
  it('rejects malformed XML', () => {
    expect(parseTrackFile('<gpx><trk>', 'broken.gpx')).toMatchObject({ ok: false })
  })
  it('rejects files that are not GPX or KML', () => {
    const r = parseTrackFile('<html><body/></html>', 'page.html')
    expect(r.ok ? '' : r.error).toMatch(/isn't a GPX or KML track/)
  })
  it('rejects a file with no track points', () => {
    const r = parseTrackFile(gpx(''), 'empty.gpx')
    expect(r.ok ? '' : r.error).toMatch(/doesn't contain a flight track/)
  })
  it('rejects files over 10 MB', () => {
    const r = parseTrackFile('x'.repeat(10 * 1024 * 1024 + 1), 'huge.gpx')
    expect(r.ok ? '' : r.error).toMatch(/larger than 10 MB/)
  })
})

describe('cleanTrack', () => {
  it('sorts by time and drops duplicate timestamps', () => {
    const p = (t: number, lat: number) => ({ t, lat, lon: -118, altFt: 0 })
    const r = cleanTrack([p(3000, 34.002), p(1000, 34), p(1000, 34), p(2000, 34.001)])
    expect(r.points.map((x) => x.t)).toEqual([1000, 2000, 3000])
    expect(r.duplicatesRemoved).toBe(1)
  })
})
