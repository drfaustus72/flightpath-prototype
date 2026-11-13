import { Suspense, lazy, useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { mapPoints } from '../../domain/directory'
import { useActive, useWorld } from '../../store/hooks'
import { Ident, ScreenTitle } from '../../ui/primitives'
import { PointsSketch } from './PointsSketch'

const PointsMap = lazy(() => import('./PointsMap'))

export function MapScreen() {
  const world = useWorld()
  const { account } = useActive()
  const navigate = useNavigate()
  const points = useMemo(() => mapPoints(world, account.id), [world, account.id])
  const [failure, setFailure] = useState<string | null>(null)
  const onFail = useCallback((reason: string) => setFailure(reason), [])
  const onSelect = useCallback((icao: string) => navigate(`/airports/${icao}`), [navigate])
  const label = `Map of ${points.length} airports with schools, CFIs or pilots`

  return (
    <div className="flex flex-col gap-4">
      <div>
        <ScreenTitle>Map</ScreenTitle>
        <p className="text-ink-muted">Schools, clubs and CFIs at their airports. Pilots are only counted, never pinned.</p>
      </div>
      {failure ? (
        <figure>
          <PointsSketch points={points} label={label} onSelect={onSelect} />
          <figcaption className="mt-1 text-[13px] text-ink-muted">{failure} Showing a simple chart instead.</figcaption>
        </figure>
      ) : (
        <Suspense fallback={<PointsSketch points={points} label={label} onSelect={onSelect} />}>
          <div role="img" aria-label={label}>
            <PointsMap points={points} onSelect={onSelect} onFail={onFail} />
          </div>
        </Suspense>
      )}

      <ul className="flex flex-col divide-y divide-hairline rounded-[var(--radius-panel)] border border-hairline bg-surface" aria-label="Airports on the map">
        {points.map((p) => (
          <li key={p.airport.icao}>
            <Link to={`/airports/${p.airport.icao}`} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
              <span className="min-w-0">
                <span className="block font-semibold">
                  <Ident>{p.airport.icao}</Ident> <span className="font-normal text-ink-muted">{p.airport.city}</span>
                </span>
                <span className="block truncate text-[14px] text-ink-muted">
                  {[
                    p.clubs.length > 0 && `${p.clubs.length} ${p.clubs.length === 1 ? 'school or club' : 'schools and clubs'}`,
                    p.cfis > 0 && `${p.cfis} ${p.cfis === 1 ? 'CFI' : 'CFIs'}`,
                    p.pilots > 0 && `${p.pilots} ${p.pilots === 1 ? 'pilot' : 'pilots'} based here`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
