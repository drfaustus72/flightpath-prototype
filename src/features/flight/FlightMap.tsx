import { Suspense, lazy, useCallback, useState } from 'react'
import { RouteSketch } from '../../ui/RouteSketch'

const RouteMap = lazy(() => import('./RouteMap'))

/** Interactive map when possible; the static sketch while loading or if tiles/WebGL fail. */
export function FlightMap({ route, label }: { route: readonly [number, number][]; label: string }) {
  const [failure, setFailure] = useState<string | null>(null)
  const onFail = useCallback((reason: string) => setFailure(reason), [])

  if (failure) {
    return (
      <figure>
        <RouteSketch route={route} height={220} label={label} />
        <figcaption className="mt-1 text-[13px] text-ink-muted">{failure} Showing the route only.</figcaption>
      </figure>
    )
  }
  return (
    <Suspense fallback={<RouteSketch route={route} height={220} label={label} />}>
      <div role="img" aria-label={label}>
        <RouteMap route={route} onFail={onFail} />
      </div>
    </Suspense>
  )
}
