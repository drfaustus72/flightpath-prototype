import 'maplibre-gl/dist/maplibre-gl.css'
import { type ErrorEvent, LngLatBounds, Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef } from 'react'

// MapLibre 6 looks for its worker next to its own module, which no longer exists once bundled.
// Ship the self-contained worker as a static asset and point MapLibre at it.
setWorkerUrl(workerUrl)

/** OpenFreeMap: free vector tiles, no key. A light style keeps the route the loudest thing on the map. */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * Interactive route map. Loaded lazily (MapLibre is large). Calls `onFail` if WebGL or the
 * tiles are unavailable, so the parent can fall back to the static route sketch.
 */
export default function RouteMap({ route, onFail }: { route: readonly [number, number][]; onFail: (reason: string) => void }) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = container.current
    if (!el || route.length < 2) return
    let map: MapLibreMap
    try {
      const bounds = route.reduce(
        (b, p) => b.extend(p),
        new LngLatBounds(route[0] as [number, number], route[0] as [number, number]),
      )
      map = new MapLibreMap({
        container: el,
        style: STYLE_URL,
        bounds,
        fitBoundsOptions: { padding: 32, maxZoom: 13 },
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
    // Tiles from a blocked or offline network: give up after a few seconds without a loaded style.
    const timeout = window.setTimeout(() => {
      if (!map.isStyleLoaded()) fail('Map tiles didn’t load.')
    }, 8000)
    map.on('error', (e: ErrorEvent) => {
      if (!map.isStyleLoaded()) fail('Map tiles didn’t load.', e.error)
    })
    map.on('load', () => {
      window.clearTimeout(timeout)
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.map((p) => [p[0], p[1]]) } },
      })
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': token('--color-chart-blue'), 'line-width': 4 },
      })
      const ends = [route[0], route.at(-1)].filter((p): p is [number, number] => p !== undefined)
      map.addSource('ends', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: ends.map((p, i) => ({ type: 'Feature', properties: { end: i }, geometry: { type: 'Point', coordinates: [p[0], p[1]] } })),
        },
      })
      map.addLayer({
        id: 'ends',
        type: 'circle',
        source: 'ends',
        paint: {
          'circle-radius': 6,
          'circle-color': ['case', ['==', ['get', 'end'], 0], token('--color-surface'), token('--color-magenta')],
          'circle-stroke-color': token('--color-magenta'),
          'circle-stroke-width': 3,
        },
      })
    })
    return () => {
      window.clearTimeout(timeout)
      map.remove()
    }
  }, [route, onFail])

  return <div ref={container} className="h-72 w-full overflow-hidden rounded-[var(--radius-panel)] border border-hairline" />
}
