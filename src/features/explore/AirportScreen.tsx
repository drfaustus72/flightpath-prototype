import { Flag } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { airportPage } from '../../domain/directory'
import { useActive, useWorld } from '../../store/hooks'
import { AirportMark } from '../../ui/AirportMark'
import { ButtonLink, EmptyState, Ident } from '../../ui/primitives'
import { ClubRow } from '../clubs/ClubRow'
import { PersonRow } from '../social/PersonRow'

export function AirportScreen() {
  const { icao = '' } = useParams()
  const world = useWorld()
  const { account } = useActive()
  const page = airportPage(world, account.id, icao)

  if (!page) {
    return <EmptyState title="Airport not found" body="This demo covers Southern California, Arizona and Nevada airports." action={<ButtonLink to="/explore">Go to Explore</ButtonLink>} />
  }
  const { airport, clubs, cfis, pilots, missions } = page

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <AirportMark size={64} />
        <div>
          <h1 className="text-[30px] leading-tight font-bold">
            <Ident>{airport.icao}</Ident>
          </h1>
          <p className="text-ink-muted">
            {airport.name}, {airport.city} · field elevation <Ident>{airport.elevationFt.toLocaleString('en-US')}</Ident> ft
          </p>
        </div>
      </div>

      <ButtonLink to={`/nearby?from=${airport.icao}`}>Schools and CFIs near {airport.icao}</ButtonLink>

      <Section title={`Schools and clubs at ${airport.icao}`} empty="No schools or clubs are based here yet.">
        {clubs.map((c) => (
          <ClubRow key={c.id} club={c} />
        ))}
      </Section>

      <Section title="CFIs" empty="No CFIs list this airport.">
        {cfis.map((c) => (
          <PersonRow key={c.id} person={c} detail={`${c.cfi?.ratings.join(', ') ?? 'CFI'} · @${c.handle}`} />
        ))}
      </Section>

      <Section title="Pilots based here" empty="No Discoverable pilots call this airport home.">
        {pilots.map((p) => (
          <PersonRow key={p.id} person={p} detail={`@${p.handle}`} />
        ))}
      </Section>
      <p className="-mt-4 text-[13px] text-ink-muted">Only pilots who set their profile to Discoverable are listed. Pilots under 18 never are.</p>

      {missions.length > 0 && (
        <section aria-labelledby="airport-missions" className="flex flex-col gap-2">
          <h2 id="airport-missions" className="font-semibold">
            Missions to {airport.icao}
          </h2>
          <ul className="flex flex-col gap-2">
            {missions.map((m) => (
              <li key={m.code}>
                <Link
                  to={`/missions/${m.code}`}
                  className="flex min-h-14 items-center gap-2 rounded-[var(--radius-panel)] border border-magenta/30 bg-magenta-tint px-4 font-semibold text-magenta"
                >
                  <Flag size={16} aria-hidden="true" /> {m.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  const id = `airport-${title.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="font-semibold">
        {title}
      </h2>
      {children.length === 0 ? <p className="text-ink-muted">{empty}</p> : <ul className="flex flex-col gap-2">{children}</ul>}
    </section>
  )
}
