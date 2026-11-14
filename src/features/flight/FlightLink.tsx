import { Link } from 'react-router'
import { accountById } from '../../domain/social'
import type { Flight } from '../../domain/types'
import { useWorld } from '../../store/hooks'

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')

/** A row linking to a flight, with its pilot and date. */
export function FlightLink({ flight }: { flight: Flight }) {
  const world = useWorld()
  const pilot = accountById(world, flight.pilotId)
  return (
    <Link to={`/flights/${flight.id}`} className="flex min-h-14 flex-col justify-center rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-2">
      <span className="font-semibold">{flight.title}</span>
      <span className="text-[14px] text-ink-muted">
        {pilot?.displayName} · {day(flight.startedAt)}
      </span>
    </Link>
  )
}
