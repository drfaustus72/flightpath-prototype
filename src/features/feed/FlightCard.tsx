import { MonitorPlay } from 'lucide-react'
import { Link } from 'react-router'
import { formatDuration, routeForViewer } from '../../domain/flights'
import type { Flight } from '../../domain/types'
import { useActive, useWorld } from '../../store/hooks'
import { RouteSketch } from '../../ui/RouteSketch'
import { Ident } from '../../ui/primitives'

export function FlightCard({ flight }: { flight: Flight }) {
  const world = useWorld()
  const { account } = useActive()
  const pilot = world.accounts.find((a) => a.id === flight.pilotId)
  const route = routeForViewer(flight, account.id)
  const stamps = world.achievements.filter((a) => a.flightId === flight.id && a.kind === 'stamp')

  return (
    <article className="rounded-[var(--radius-panel)] border border-hairline bg-surface">
      <Link to={`/flights/${flight.id}`} className="flex flex-col gap-3 p-4">
        <header>
          <p className="text-[14px] text-ink-muted">
            {pilot?.displayName}
            {flight.startedAt && ` · ${new Date(flight.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
          </p>
          <h2 className="text-[18px] font-bold">{flight.title}</h2>
          {flight.isSimulator && (
            <p className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-chart-blue">
              <MonitorPlay size={14} aria-hidden="true" /> Simulator
            </p>
          )}
        </header>
        {flight.caption && <p className="line-clamp-3">{flight.caption}</p>}
        {route && <RouteSketch route={route} label={`Route of ${flight.title}`} />}
        <p className="flex flex-wrap gap-x-4 text-[14px] text-ink-muted">
          <span>
            <Ident>{flight.stats.distanceNm.toFixed(1)}</Ident> nm
          </span>
          <span>
            <Ident>{formatDuration(flight.stats.durationSec)}</Ident>
          </span>
          {stamps.length > 0 && (
            <span className="font-semibold text-magenta">
              New: <Ident>{stamps.map((s) => s.icao).join(' ')}</Ident>
            </span>
          )}
        </p>
      </Link>
    </article>
  )
}
