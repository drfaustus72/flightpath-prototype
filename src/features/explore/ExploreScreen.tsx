import { ChevronRight, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { airportForQuery } from '../../domain/directory'
import { search, suggestionsFor } from '../../domain/discovery'
import type { Account } from '../../domain/types'
import { canFollow } from '../../domain/social'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { PersonRow } from '../social/PersonRow'
import { ClubRow } from '../clubs/ClubRow'
import { AirportMark } from '../../ui/AirportMark'
import { Button, Ident, ScreenTitle } from '../../ui/primitives'

export function ExploreScreen() {
  const world = useWorld()
  const { account } = useActive()
  const [query, setQuery] = useState('')
  const results = search(world, account.id, query)
  const searching = query.trim().replace(/^@/, '').length >= 2
  const airport = airportForQuery(world, query)
  const total = results.pilots.length + results.cfis.length + results.clubs.length

  return (
    <div className="flex flex-col gap-5">
      <ScreenTitle>Explore</ScreenTitle>

      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="explore-search" className="sr-only">
          Search pilots, CFIs and schools
        </label>
        <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-hairline bg-surface px-3 focus-within:outline-2 focus-within:outline-chart-blue">
          <Search size={18} className="shrink-0 text-ink-muted" aria-hidden="true" />
          <input
            id="explore-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, @handle, airport or school"
            autoComplete="off"
            className="min-h-12 w-full bg-transparent text-[16px] outline-none"
          />
        </div>
      </form>

      {searching ? (
        <div aria-live="polite" className="flex flex-col gap-5">
          {airport && (
            <Link
              to={`/airports/${airport.icao}`}
              className="flex min-h-14 items-center gap-3 rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-2"
            >
              <AirportMark size={40} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  <Ident>{airport.icao}</Ident> airport page
                </span>
                <span className="block truncate text-[14px] text-ink-muted">{airport.name}</span>
              </span>
              <ChevronRight size={20} aria-hidden="true" />
            </Link>
          )}
          {total === 0 && !airport && (
            <p className="text-ink-muted">
              No pilots, CFIs or schools match “{query.trim()}”. Pilots who keep their profile Public show up only on their exact @handle.
            </p>
          )}
          {results.cfis.length > 0 && <PeopleList title="CFIs" people={results.cfis} />}
          {results.pilots.length > 0 && <PeopleList title="Pilots" people={results.pilots} />}
          {results.clubs.length > 0 && (
            <section aria-labelledby="schools-title">
              <h2 id="schools-title" className="mb-2 font-semibold">
                Schools and clubs
              </h2>
              <ul className="flex flex-col gap-2">
                {results.clubs.map((c) => (
                  <ClubRow key={c.id} club={c} />
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <>
          <Link
            to="/missions"
            className="flex min-h-16 items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-magenta/30 bg-magenta-tint px-4 py-3"
          >
            <span>
              <span className="block font-semibold text-magenta">Missions</span>
              <span className="block text-[14px] text-ink-muted">{world.missions.length} Southern California flights with a story and something to learn</span>
            </span>
            <ChevronRight size={20} aria-hidden="true" className="text-magenta" />
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to={`/nearby?from=${account.homeAirport}`}
              className="flex min-h-16 flex-col justify-center rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-3"
            >
              <span className="font-semibold">Schools and CFIs</span>
              <span className="text-[14px] text-ink-muted">
                near <Ident>{account.homeAirport}</Ident>
              </span>
            </Link>
            <Link to="/map" className="flex min-h-16 flex-col justify-center rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-3">
              <span className="font-semibold">Map</span>
              <span className="text-[14px] text-ink-muted">Schools, CFIs, pilot counts</span>
            </Link>
          </div>
          <Suggestions />
        </>
      )}
    </div>
  )
}

function PeopleList({ title, people }: { title: string; people: Account[] }) {
  const id = `results-${title.toLowerCase()}`
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2 font-semibold">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {people.map((p) => (
          <PersonRow
            key={p.id}
            person={p}
            detail={`@${p.handle} · ${p.cfi?.verified ? `${p.cfi.ratings.join(', ')} at ` : ''}${p.homeAirport}`}
          />
        ))}
      </ul>
    </section>
  )
}

function Suggestions() {
  const world = useWorld()
  const { account } = useActive()
  const follow = useAppStore((s) => s.follow)
  const suggestions = suggestionsFor(world, account.id)

  return (
    <section aria-labelledby="suggest-title" className="flex flex-col gap-2">
      <h2 id="suggest-title" className="font-semibold">
        Pilots you may know
      </h2>
      {suggestions.length === 0 ? (
        <p className="text-ink-muted">No suggestions right now. Search for pilots by name, @handle or airport.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {suggestions.map(({ account: p, reasons }) => (
            <PersonRow
              key={p.id}
              person={p}
              detail={reasons.join(' · ')}
              action={
                canFollow(world, account.id, p.id) && (
                  <Button onClick={() => follow(p.id)} aria-label={`Follow ${p.displayName}`}>
                    Follow
                  </Button>
                )
              }
            />
          ))}
        </ul>
      )}
    </section>
  )
}
