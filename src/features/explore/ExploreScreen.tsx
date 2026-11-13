import { Search } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { clubPlanName } from '../../domain/clubs'
import { search, suggestionsFor } from '../../domain/discovery'
import type { Account } from '../../domain/types'
import { canFollow } from '../../domain/social'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Avatar } from '../../ui/Avatar'
import { Button, Ident, ScreenTitle } from '../../ui/primitives'

export function ExploreScreen() {
  const world = useWorld()
  const { account } = useActive()
  const [query, setQuery] = useState('')
  const results = search(world, account.id, query)
  const searching = query.trim().replace(/^@/, '').length >= 2
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
          {total === 0 && (
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
                  <li key={c.id} className="flex min-h-14 items-center gap-3 rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-2">
                    <span aria-hidden="true" className="grid size-10 place-items-center rounded-[var(--radius-control)] bg-magenta-tint font-bold text-magenta">
                      {c.initials}
                    </span>
                    <span>
                      <span className="block font-semibold">{c.name}</span>
                      <span className="block text-[14px] text-ink-muted">
                        {clubPlanName(c)} · <Ident>{c.homeAirport}</Ident>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <Suggestions />
      )}
    </div>
  )
}

function PersonRow({ person, detail, action }: { person: Account; detail: string; action?: ReactNode }) {
  return (
    <li className="flex min-h-14 items-center gap-3 rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-2">
      <Avatar account={person} />
      <Link to={`/u/${person.handle}`} className="min-w-0 flex-1">
        <span className="block font-semibold">{person.displayName}</span>
        <span className="block truncate text-[14px] text-ink-muted">{detail}</span>
      </Link>
      {action}
    </li>
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
      <p className="mt-2 text-[14px] text-ink-muted">
        Missions, airport pages and a directory of schools and CFIs near <Ident>{account.homeAirport}</Ident> come in a later build.
      </p>
    </section>
  )
}
