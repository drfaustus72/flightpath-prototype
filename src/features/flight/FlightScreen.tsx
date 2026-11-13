import { Info, MonitorPlay } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation, useParams } from 'react-router'
import { routeForViewer } from '../../domain/flights'
import { canViewFlight } from '../../domain/visibility'
import { recognitionFor } from '../../domain/recognition'
import { useActive, useWorld } from '../../store/hooks'
import { AirportMark } from '../../ui/AirportMark'
import { ButtonLink, EmptyState, Ident, ScreenTitle } from '../../ui/primitives'
import { FlightMap } from './FlightMap'
import { FlightStats } from './FlightStats'
import { DebriefThread, FlightSignoff, TagAnswer } from './FlightTraining'
import { Comments } from '../social/Comments'
import { FlightPeople } from '../social/FlightPeople'
import { PersonLink } from '../social/PersonLink'
import { PropsButton } from '../social/PropsButton'
import { ReportButton } from '../social/ReportButton'

export function FlightScreen() {
  const { flightId = '' } = useParams()
  const world = useWorld()
  const { account } = useActive()
  const location = useLocation()
  const flight = world.flights.find((f) => f.id === flightId)

  // Links like "/flights/x#comments-title" jump to that section.
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView()
  }, [location.hash])

  if (!flight || !canViewFlight(world, flight, account.id)) {
    return (
      <EmptyState
        title="Flight not found"
        body="It may have been deleted, or its pilot keeps it private."
        action={<ButtonLink to="/feed">Go to feed</ButtonLink>}
      />
    )
  }

  const pilot = world.accounts.find((a) => a.id === flight.pilotId)
  const club = world.clubs.find((c) => c.id === flight.clubId)
  const route = routeForViewer(flight, account.id)
  const justLogged = new Set((location.state as { newAirports?: string[] } | null)?.newAirports ?? [])
  const recognition = recognitionFor(world, flight.pilotId)
  const firstVisits = recognition.airports.filter((a) => a.firstFlightId === flight.id)
  const earnedBadges = recognition.badges.filter((b) => b.flightId === flight.id)
  const newStamps = firstVisits.filter((a) => justLogged.has(a.icao))

  return (
    <div className="flex flex-col gap-5">
      {newStamps.length > 0 && (
        <section aria-live="polite" className="flex items-center gap-4 rounded-[var(--radius-panel)] border border-magenta/30 bg-magenta-tint p-4">
          <div className="animate-[stamp_520ms_cubic-bezier(.2,1.4,.4,1)_both]">
            <AirportMark size={64} />
          </div>
          <div>
            <p className="font-semibold text-magenta">{newStamps.length === 1 ? 'New stamp' : `${newStamps.length} new stamps`}</p>
            <p className="text-[20px] font-bold">
              {newStamps.map((s, i) => (
                <span key={s.icao}>
                  {i > 0 && ', '}
                  <Ident>{s.icao}</Ident>
                </span>
              ))}
            </p>
            <p className="text-[14px] text-ink-muted">{newStamps.map((s) => s.name).join(', ')}</p>
          </div>
        </section>
      )}

      <div>
        <ScreenTitle>{flight.title}</ScreenTitle>
        <p className="text-ink-muted">
          {pilot && <PersonLink account={pilot} className="text-ink" />}
          {flight.startedAt && ` · ${new Date(flight.startedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`}
          {club && ` · ${club.name}`}
        </p>
        {flight.isSimulator && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-chart-blue-tint px-2.5 py-0.5 text-[13px] font-semibold text-chart-blue">
            <MonitorPlay size={14} aria-hidden="true" /> Simulator session
          </p>
        )}
        {flight.simConfirmation && club && (
          <p className="mt-2 text-[14px] text-ink-muted">
            {flight.simConfirmation.status === 'pending' && `Waiting for ${club.name} to confirm this session before it counts toward XP.`}
            {flight.simConfirmation.status === 'confirmed' && `Confirmed by ${club.name}.`}
            {flight.simConfirmation.status === 'declined' && `${club.name} didn’t confirm this session, so it doesn’t count toward XP.`}
          </p>
        )}
      </div>

      <FlightPeople flight={flight} />
      <TagAnswer flight={flight} />

      {flight.caption && <p className="max-w-[60ch] text-[17px]">{flight.caption}</p>}

      {route ? (
        <FlightMap route={route} label={`Route of ${flight.title}`} />
      ) : (
        <p className="text-ink-muted">The pilot keeps this route private.</p>
      )}

      <FlightStats stats={flight.stats} landings={flight.landings.length} />

      {flight.landings.length > 0 && (
        <section aria-labelledby="landings-title">
          <h2 id="landings-title" className="mb-2 font-semibold">
            Landings
          </h2>
          <ol className="divide-y divide-hairline rounded-[var(--radius-panel)] border border-hairline bg-surface">
            {flight.landings.map((l, i) => (
              <li key={`${l.at}-${i}`} className="flex items-center justify-between px-4 py-3">
                <span className="font-semibold">{l.icao ? <Ident>{l.icao}</Ident> : 'Unknown airport'}</span>
                <span className="text-[14px] text-ink-muted">{l.kind === 'full_stop' ? 'Full stop' : 'Touch-and-go'}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {(firstVisits.length > 0 || earnedBadges.length > 0) && (
        <section aria-labelledby="earned-title">
          <h2 id="earned-title" className="mb-2 font-semibold">
            Earned on this flight
          </h2>
          <ul className="flex flex-wrap gap-2">
            {firstVisits.map((a) => (
              <li key={a.icao} className="rounded-full border border-magenta/30 bg-magenta-tint px-3 py-1 text-[14px] text-magenta">
                <Ident>{a.icao}</Ident> stamp
              </li>
            ))}
            {earnedBadges.map((b) => (
              <li key={b.code} className="rounded-full border border-hairline bg-surface px-3 py-1 text-[14px]">
                {b.title}
              </li>
            ))}
          </ul>
        </section>
      )}

      <FlightSignoff flight={flight} />
      <DebriefThread flight={flight} />

      <div className="flex items-center justify-between border-y border-hairline">
        <PropsButton flight={flight} />
        {account.id !== flight.pilotId && <ReportButton target={{ kind: 'flight', id: flight.id }} subject="flight" />}
      </div>
      <Comments flight={flight} />

      {account.id === flight.pilotId && flight.importNotes.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Import notes">
          {flight.importNotes.map((n) => (
            <li key={n} className="flex gap-2 text-[14px] text-ink-muted">
              <Info size={16} className="mt-0.5 shrink-0 text-chart-blue" aria-hidden="true" />
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
