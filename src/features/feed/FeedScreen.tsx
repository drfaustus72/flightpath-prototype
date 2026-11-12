import { Plus } from 'lucide-react'
import { feedFor } from '../../domain/flights'
import { useActive, useWorld } from '../../store/hooks'
import { ButtonLink, EmptyState, ScreenTitle } from '../../ui/primitives'
import { FlightCard } from './FlightCard'

export function FeedScreen() {
  const world = useWorld()
  const { account } = useActive()
  const flights = feedFor(world, account.id)

  return (
    <>
      <ScreenTitle>Feed</ScreenTitle>
      {flights.length === 0 ? (
        <EmptyState
          title="No flights in your feed yet"
          body="Flights from you, pilots you follow and your clubs show up here. Log a flight to post your first one."
          action={
            <ButtonLink to="/log" tone="primary">
              <Plus size={18} aria-hidden="true" />
              Log flight
            </ButtonLink>
          }
        />
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
