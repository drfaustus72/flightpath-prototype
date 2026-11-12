import { EmptyState, Ident, ScreenTitle } from '../../ui/primitives'
import { useActive } from '../../store/hooks'

export function ExploreScreen() {
  const { account } = useActive()
  return (
    <>
      <ScreenTitle>Explore</ScreenTitle>
      <EmptyState
        title="Missions are on their way"
        body="Explore will suggest missions and airports to fly to from your home airport. The mission catalog isn't in this build yet."
        action={
          <p className="text-[14px] text-ink-muted">
            Home airport: <Ident>{account.homeAirport}</Ident>
          </p>
        }
      />
    </>
  )
}
