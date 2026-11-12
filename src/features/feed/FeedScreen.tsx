import { Plus } from 'lucide-react'
import { ButtonLink, EmptyState, ScreenTitle } from '../../ui/primitives'

export function FeedScreen() {
  return (
    <>
      <ScreenTitle>Feed</ScreenTitle>
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
    </>
  )
}
