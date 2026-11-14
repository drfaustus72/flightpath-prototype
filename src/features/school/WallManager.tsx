import { Link } from 'react-router'
import { missionWall, pendingReposts, wallCandidates } from '../../domain/schoolOps'
import { canInClub } from '../../domain/tiers'
import type { Club } from '../../domain/types'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Button, Panel } from '../../ui/primitives'

/**
 * Admin view of the Mission Wall: ask pilots to feature school-verified missions, see who hasn't
 * answered yet, and remove cards. Nothing appears on the wall until the pilot approves.
 */
export function WallManager({ club }: { club: Club }) {
  const world = useWorld()
  const { access } = useActive()
  const ask = useAppStore((s) => s.requestRepost)
  const remove = useAppStore((s) => s.removeRepost)
  if (!canInClub(access, 'school.repostRequests', club.id)) return null

  const name = (id: string) => world.accounts.find((a) => a.id === id)?.displayName ?? 'Pilot'
  const title = (code: string) => world.missions.find((m) => m.code === code)?.title ?? code
  const candidates = wallCandidates(world, club.id)
  const pending = pendingReposts(world, club.id)
  const featured = missionWall(world, club.id)

  return (
    <section aria-labelledby="wall-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="wall-title" className="font-semibold">
          Mission Wall
        </h2>
        <Link to={`/clubs/${club.id}/wall`} className="min-h-11 py-2 text-[14px] font-semibold text-chart-blue">
          Preview the wall
        </Link>
      </div>
      <p className="text-[14px] text-ink-muted">
        Ask pilots to feature missions you verified on your public page. Nothing goes up until they say yes, and they can take it down
        any time. Pilots under 18 aren’t asked.
      </p>

      {featured.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="On the wall">
          {featured.map((i) => (
            <li key={i.request.id}>
              <Panel className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold">{i.mission.title}</span>
                  <span className="block text-[14px] text-ink-muted">{i.pilot.displayName} · on the wall</span>
                </span>
                <Button onClick={() => remove(i.request.id)} aria-label={`Remove ${i.pilot.displayName}’s ${i.mission.title}`}>
                  Remove
                </Button>
              </Panel>
            </li>
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Waiting for the pilot">
          {pending.map((i) => (
            <li key={i.request.id}>
              <Panel className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold">{i.mission.title}</span>
                  <span className="block text-[14px] text-ink-muted">Waiting for {i.pilot.displayName}</span>
                </span>
                <Button onClick={() => remove(i.request.id)} aria-label={`Withdraw request to ${i.pilot.displayName}`}>
                  Withdraw
                </Button>
              </Panel>
            </li>
          ))}
        </ul>
      )}

      {candidates.length === 0 ? (
        featured.length + pending.length === 0 && <p className="text-ink-muted">When you verify a member’s mission, you can ask to feature it here.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Missions you could feature">
          {candidates.map((v) => (
            <li key={v.id}>
              <Panel className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold">{title(v.missionCode)}</span>
                  <span className="block text-[14px] text-ink-muted">{name(v.pilotId)}</span>
                </span>
                <Button tone="primary" onClick={() => ask(v.id)} aria-label={`Ask ${name(v.pilotId)} to feature ${title(v.missionCode)}`}>
                  Ask to feature
                </Button>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
