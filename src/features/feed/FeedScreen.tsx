import { Plus } from 'lucide-react'
import { useState } from 'react'
import { type FeedScope, feedClubsOf, feedFor } from '../../domain/social'
import { useActive, useWorld } from '../../store/hooks'
import { ButtonLink, EmptyState, ScreenTitle } from '../../ui/primitives'
import { FlightCard } from './FlightCard'

export function FeedScreen() {
  const world = useWorld()
  const { account } = useActive()
  const [scope, setScope] = useState<FeedScope>('following')
  const clubs = feedClubsOf(world, account.id)
  const active: FeedScope = clubs.length === 0 ? 'following' : scope
  const flights = feedFor(world, account.id, active)

  return (
    <>
      <ScreenTitle>Feed</ScreenTitle>
      {clubs.length > 0 && (
        <div role="group" aria-label="Show flights from" className="mt-3 inline-flex rounded-[var(--radius-control)] border border-hairline bg-surface p-1">
          {(
            [
              ['following', 'Following'],
              ['clubs', clubs.length === 1 ? (clubs[0]?.name ?? 'Club') : 'Your clubs'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={active === value}
              onClick={() => setScope(value)}
              className={`min-h-11 rounded-[calc(var(--radius-control)-4px)] px-3 text-[14px] font-semibold ${
                active === value ? 'bg-chart-blue text-white' : 'text-ink-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {flights.length === 0 ? (
        active === 'clubs' ? (
          <EmptyState title="No club flights yet" body="Flights your clubmates tag to the club show up here." />
        ) : (
          <EmptyState
            title="No flights in your feed yet"
            body="Your flights and flights from pilots you follow show up here. Log a flight, or find pilots to follow in Explore."
            action={
              <ButtonLink to="/log" tone="primary">
                <Plus size={18} aria-hidden="true" />
                Log flight
              </ButtonLink>
            }
          />
        )
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {flights.map((f) => (
            <li key={f.id}>
              <FlightCard flight={f} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
