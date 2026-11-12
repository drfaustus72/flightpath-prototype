import { can } from '../../domain/tiers'
import { useActive } from '../../store/hooks'
import { ProGate } from '../../ui/ProGate'
import { EmptyState, ScreenTitle } from '../../ui/primitives'

export function ProgressScreen() {
  const { access } = useActive()
  return (
    <>
      <ScreenTitle>Progress</ScreenTitle>
      <EmptyState
        title="No stamps or badges yet"
        body="Every new airport you land at earns a stamp, and milestones like your first solo cross-country earn a badge. Log a flight to start your collection."
      />
      {can(access, 'progress.xp') ? (
        <EmptyState
          title="XP and ranks start with your next flight"
          body="Your Pilot Pro progress, pathways and challenges will appear here once you log flights."
        />
      ) : (
        <ProGate plan="Pilot Pro">
          XP, ranks, pathways and challenges track your progress across every flight.
        </ProGate>
      )}
    </>
  )
}
