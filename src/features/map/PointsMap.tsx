import 'maplibre-gl/dist/maplibre-gl.css'
import { type ErrorEvent, LngLatBounds, Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef } from 'react'
import type { MapPoint } from '../../domain/directory'

setWorkerUrl(workerUrl)

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * Directory map: one circle per airport, sized by what's there. Pilots are only ever counted,
 * never pinned. Calls `onSelect` with an airport when tapped, and `onFail` if tiles/WebGL fail.
 */
export default function PointsMap({
  points,
  onSelect,
  onFail,
}: {
  points: readonly MapPoint[]
  onSelect: (icao: string) => void
  onFail: (reason: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = container.current
    const first = points[0]
    if (!el || !first) return
    let map: MapLibreMap
    try {
      const start: [number, number] = [first.airport.lon, first.airport.lat]
      const bounds = points.reduce((b, p) => b.extend([p.airport.lon, p.airport.lat]), new LngLatBounds(start, start))
      map = new MapLibreMap({
        container: el,
        style: STYLE_URL,
        bounds,
        fitBoundsOptions: { padding: 40, maxZoom: 10 },
        attributionControl: { compact: true },
        cooperativeGestures: true,
      })
    } catch (error) {
      console.warn('[flightpath] Map unavailable', error)
      onFail('This device can’t show interactive maps.')
      return
    }
    let failed = false
    const fail = (reason: string, error?: unknown) => {
      if (failed) return
      failed = true
      console.warn(`[flightpath] ${reason}`, error)
      onFail(reason)
    }
    const timeout = window.setTimeout(() => {
      if (!map.isStyleLoaded()) fail('Map tiles didn’t load.')
    }, 8000)
    map.on('error', (e: ErrorEvent) => {
      if (!map.isStyleLoaded()) fail('Map tiles didn’t load.', e.error)
    })
    map.on('load', () => {
      window.clearTimeout(timeout)
      map.addSource('points', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: points.map((p) => ({
            type: 'Feature',
            properties: { icao: p.airport.icao, size: p.clubs.length + p.cfis + p.pilots, schools: p.clubs.length },
            geometry: { type: 'Point', coordinates: [p.airport.lon, p.airport.lat] },
          })),
        },
      })
      map.addLayer({
        id: 'points',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-radius': ['+', 7, ['*', 2, ['get', 'size']]],
          'circle-color': ['case', ['>', ['get', 'schools'], 0], token('--color-magenta'), token('--color-chart-blue')],
          'circle-opacity': 0.85,
          'circle-stroke-color': token('--color-surface'),
          'circle-stroke-width': 2,
        },
      })
      map.addLayer({
        id: 'labels',
        type: 'symbol',
        source: 'points',
        layout: { 'text-field': ['get', 'icao'], 'text-offset': [0, 1.6], 'text-size': 12 },
        paint: { 'text-color': token('--color-ink'), 'text-halo-color': token('--color-surface'), 'text-halo-width': 1.5 },
      })
      map.on('click', 'points', (e) => {
        const icao = e.features?.[0]?.properties?.icao
        if (typeof icao === 'string') onSelect(icao)
      })
    })
    return () => {
      window.clearTimeout(timeout)
      map.remove()
    }
  }, [points, onSelect, onFail])

  return <div ref={container} className="h-80 w-full overflow-hidden rounded-[var(--radius-panel)] border border-hairline" />
}
