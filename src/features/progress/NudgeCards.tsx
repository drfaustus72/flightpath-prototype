import { Building2 } from 'lucide-react'
import { nudgesFor, repostRequestsFor } from '../../domain/schoolOps'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Button, ButtonLink, Panel } from '../../ui/primitives'

/**
 * What the pilot's school is asking of them: notes from staff (until dismissed) and requests to feature
 * a mission on the school's Mission Wall. Only the pilot sees these.
 */
export function NudgeCards() {
  const world = useWorld()
  const { account } = useActive()
  const dismiss = useAppStore((s) => s.dismissNudge)
  const answer = useAppStore((s) => s.answerRepost)
  const nudges = nudgesFor(world, account.id)
  const reposts = repostRequestsFor(world, account.id)
  if (nudges.length + reposts.length === 0) return null
  return (
    <section aria-label="From your school" className="flex flex-col gap-2">
      {reposts.map((r) => {
        const club = world.clubs.find((c) => c.id === r.clubId)
        const v = world.missionVerifications.find((x) => x.id === r.verificationId)
        const mission = world.missions.find((m) => m.code === v?.missionCode)
        if (!club || !mission) return null
        return (
          <Panel key={r.id} className="flex flex-col gap-2 border-chart-blue">
            <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-chart-blue">
              <Building2 size={14} aria-hidden="true" /> {club.name}
            </p>
            <p>
              {club.name} would like to feature your <span className="font-semibold">{mission.title}</span> on its Mission Wall.
            </p>
            <p className="text-[13px] text-ink-muted">
              The wall is public. It shows your name, the mission and the route as you share it. You can take it down any time.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button tone="primary" onClick={() => answer(r.id, true)}>
                Feature it
              </Button>
              <Button onClick={() => answer(r.id, false)}>No thanks</Button>
            </div>
          </Panel>
        )
      })}
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
