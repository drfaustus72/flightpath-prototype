import { Building2 } from 'lucide-react'
import { nudgesFor } from '../../domain/schoolOps'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Button, ButtonLink, Panel } from '../../ui/primitives'

/** Notes from the pilot's school staff, shown until the pilot dismisses them. Only the pilot sees these. */
export function NudgeCards() {
  const world = useWorld()
  const { account } = useActive()
  const dismiss = useAppStore((s) => s.dismissNudge)
  const nudges = nudgesFor(world, account.id)
  if (nudges.length === 0) return null
  return (
    <section aria-label="From your school" className="flex flex-col gap-2">
      {nudges.map((n) => {
        const club = world.clubs.find((c) => c.id === n.clubId)
        const from = world.accounts.find((a) => a.id === n.fromAccountId)
        const mission = world.missions.find((m) => m.code === n.missionCode)
        return (
          <Panel key={n.id} className="flex flex-col gap-2 border-chart-blue">
            <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-chart-blue">
              <Building2 size={14} aria-hidden="true" /> {club?.name}
            </p>
            <p>{n.message}</p>
            {from && <p className="text-[13px] text-ink-muted">From {from.displayName}</p>}
            <div className="flex flex-wrap gap-2">
              {mission && (
                <ButtonLink tone="primary" to={`/missions/${mission.code}`}>
                  {`Try ${mission.title}`}
                </ButtonLink>
              )}
              <Button onClick={() => dismiss(n.id)} aria-label={`Dismiss note from ${club?.name ?? 'your school'}`}>
                Dismiss
              </Button>
            </div>
          </Panel>
        )
      })}
    </section>
  )
}
