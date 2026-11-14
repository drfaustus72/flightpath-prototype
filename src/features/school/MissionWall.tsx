import { BadgeCheck } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { formatDuration, routeForViewer } from '../../domain/flights'
import { type WallItem, missionWall } from '../../domain/schoolOps'
import { clubOffers } from '../../domain/tiers'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { RouteSketch } from '../../ui/RouteSketch'
import { Button, EmptyState, ScreenTitle } from '../../ui/primitives'

const longDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '')

/** One featured mission. The route follows the pilot's own route privacy for whoever is looking. */
export function WallCard({ item, clubName }: { item: WallItem; clubName: string }) {
  const { account } = useActive()
  const remove = useAppStore((s) => s.removeRepost)
  const route = routeForViewer(item.flight, account.id)
  const own = account.id === item.pilot.id
  return (
    <article className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-hairline bg-surface p-4">
      <p className="text-[13px] font-semibold text-magenta">Mission complete</p>
      <h2 className="text-[20px] leading-tight font-bold tracking-tight">{item.mission.title}</h2>
      {route && <RouteSketch route={route} height={96} label={`Route of ${item.flight.title}`} />}
      <p className="font-ident text-[13px] text-ink-muted tabular-nums">
        {item.flight.stats.distanceNm.toFixed(0)} nm · {formatDuration(item.flight.stats.durationSec)} · {longDate(item.flight.startedAt)}
      </p>
      <p className="font-semibold">
        <Link to={`/u/${item.pilot.handle}`} className="underline-offset-2 hover:underline">
          {item.pilot.displayName}
        </Link>
      </p>
      <p className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted">
        <BadgeCheck size={14} aria-hidden="true" className="text-chart-blue" /> Verified by {clubName}
      </p>
      {own && (
        <Button className="self-start" onClick={() => remove(item.request.id)} aria-label={`Take ${item.mission.title} off the wall`}>
          Take it down
        </Button>
      )}
    </article>
  )
}

/** A School Pro school's public Mission Wall: missions it verified, featured with each pilot's approval. */
export function MissionWallScreen() {
  const { clubId = '' } = useParams()
  const world = useWorld()
  const club = world.clubs.find((c) => c.id === clubId)
  if (!club || !clubOffers(club, 'school.missionWall')) {
    return <EmptyState title="No Mission Wall here" body="Schools on School Pro can feature their pilots’ missions on a Mission Wall." />
  }
  const items = missionWall(world, club.id)
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link to={`/clubs/${club.id}`} className="min-h-11 py-2 text-[14px] font-semibold text-chart-blue">
          {club.name}
        </Link>
        <ScreenTitle>Mission Wall</ScreenTitle>
        <p className="mt-1 text-ink-muted">Missions {club.name} verified, shared by the pilots who flew them.</p>
      </div>
      {items.length === 0 ? (
        <p className="text-ink-muted">Nothing on the wall yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.request.id}>
              <WallCard item={item} clubName={club.name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
