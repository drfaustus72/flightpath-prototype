import { useState } from 'react'
import { clubPlanName } from '../../domain/clubs'
import { recognitionFor } from '../../domain/recognition'
import { milestonesFor } from '../../domain/signoffs'
import { followersOf, followingOf } from '../../domain/social'
import type { Account } from '../../domain/types'
import { canSeeField } from '../../domain/visibility'
import { homeSchoolOf } from '../../domain/world'
import { useActive, useWorld } from '../../store/hooks'
import { AirportMark } from '../../ui/AirportMark'
import { Avatar } from '../../ui/Avatar'
import { Ident, Panel, PlanBadge } from '../../ui/primitives'
import { SignoffBadge } from '../cfi/SignoffBadge'
import { certificateNames } from './labels'
import { TrackedLine } from './LogbookPanel'

export function ProfileHeader({ owner, badges }: { owner: Account; badges: string[] }) {
  const world = useWorld()
  const followers = followersOf(world, owner.id).length
  const following = followingOf(world, owner.id).length
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Avatar account={owner} size={64} />
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-bold tracking-tight">{owner.displayName}</h1>
          <p className="text-ink-muted">@{owner.handle}</p>
        </div>
      </div>
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {badges.map((l) => (
            <PlanBadge key={l}>{l}</PlanBadge>
          ))}
        </div>
      )}
      {owner.bio && <p className="max-w-[60ch]">{owner.bio}</p>}
      <p className="text-[14px] text-ink-muted">
        <Ident>{followers}</Ident> {followers === 1 ? 'follower' : 'followers'} · <Ident>{following}</Ident> following
      </p>
    </div>
  )
}

/** Home airport, home school and certificates, each only if this viewer may see it. */
export function ProfileFacts({ owner }: { owner: Account }) {
  const world = useWorld()
  const { account: viewer } = useActive()
  const see = (f: Parameters<typeof canSeeField>[3]) => canSeeField(world, viewer.id, owner, f)
  const airport = world.airports.find((a) => a.icao === owner.homeAirport)
  const homeSchool = homeSchoolOf(world, owner.id)
  const isSelf = viewer.id === owner.id

  return (
    <>
      {see('homeAirport') && (
        <Panel className="flex items-center gap-4">
          <AirportMark />
          <div>
            <p className="text-[13px] text-ink-muted">Home airport</p>
            <p className="text-[22px] font-bold">
              <Ident>{owner.homeAirport}</Ident>
            </p>
            {airport && (
              <p className="text-[14px] text-ink-muted">
                {airport.name}, {airport.city}
              </p>
            )}
          </div>
        </Panel>
      )}
      {see('homeSchool') && (
        <Panel>
          <p className="text-[13px] text-ink-muted">Home school</p>
          {homeSchool ? (
            <>
              <p className="text-[17px] font-semibold">{homeSchool.name}</p>
              <p className="text-[14px] text-ink-muted">
                {clubPlanName(homeSchool)} · <Ident>{homeSchool.homeAirport}</Ident>
              </p>
            </>
          ) : (
            <p className="text-ink-muted">{isSelf ? 'No home school. Add one to show where you train.' : 'No home school listed.'}</p>
          )}
        </Panel>
      )}
      {see('certificates') && (
        <Panel>
          <p className="text-[13px] text-ink-muted">Certificates</p>
          <p className="font-semibold">{owner.certificates.map((c) => certificateNames[c] ?? c).join(', ') || 'None yet'}</p>
        </Panel>
      )}
      {!isSelf && see('totalHours') && (
        <Panel>
          <p className="text-[13px] text-ink-muted">Total time</p>
          <p className="font-semibold">
            <Ident>{owner.totalHours.toLocaleString('en-US')}</Ident> hours{' '}
            <span className="text-[13px] font-normal text-ink-muted">
              {owner.hoursSource === 'logbook_verified' ? 'Logbook verified' : 'Self-reported'}
            </span>
          </p>
          <TrackedLine pilotId={owner.id} />
        </Panel>
      )}
    </>
  )
}

/** Training milestones, stamps and badges. Follows the owner's "achievements" setting. */
export function TrophyCase({ owner }: { owner: Account }) {
  const world = useWorld()
  const { account: viewer } = useActive()
  if (!canSeeField(world, viewer.id, owner, 'achievements')) return null
  const r = recognitionFor(world, owner.id)
  const milestones = milestonesFor(world, owner.id).filter((m) => m.claim || m.signoff)

  return (
    <section aria-labelledby="trophy-title" className="flex flex-col gap-3">
      <h2 id="trophy-title" className="font-semibold">
        Trophy case
      </h2>
      {milestones.length > 0 && (
        <ul className="flex flex-col gap-2">
          {milestones.map((m) => (
            <li key={m.code} className="rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-3">
              <p className="font-semibold">{m.title}</p>
              {m.signoff ? <SignoffBadge signoff={m.signoff} compact /> : <p className="text-[13px] text-ink-muted">Self-reported</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[14px] text-ink-muted">
        <Ident>{r.airports.length}</Ident> airports · <Ident>{r.states.length}</Ident> states · <Ident>{r.badges.length}</Ident> badges
      </p>
      {r.badges.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {r.badges.map((b) => (
            <li key={b.code} className="rounded-full border border-hairline bg-surface px-3 py-1 text-[14px] font-semibold">
              {b.title}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** "Where I've landed": stamped airports on a plain chart sketch, no live location. */
export function LandedMap({ owner }: { owner: Account }) {
  const world = useWorld()
  const { account: viewer } = useActive()
  const [focus, setFocus] = useState<string | null>(null)
  if (!canSeeField(world, viewer.id, owner, 'airportMap')) return null
  const stamped = recognitionFor(world, owner.id).airports
  const pts = stamped.flatMap((s) => {
    const a = world.airports.find((x) => x.icao === s.icao)
    return a ? [{ icao: a.icao, name: a.name, lat: a.lat, lon: a.lon }] : []
  })
  if (pts.length === 0) return null

  const w = 320
  const h = 180
  const pad = 22
  const midLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
  const kx = Math.cos((midLat * Math.PI) / 180)
  const xs = pts.map((p) => p.lon * kx)
  const ys = pts.map((p) => p.lat)
  const spanX = Math.max(Math.max(...xs) - Math.min(...xs), 0.4)
  const spanY = Math.max(Math.max(...ys) - Math.min(...ys), 0.4)
  const scale = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY)
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2
  const place = (p: { lat: number; lon: number }) => [w / 2 + (p.lon * kx - cx) * scale, h / 2 - (p.lat - cy) * scale] as const

  return (
    <section aria-labelledby="landed-title" className="flex flex-col gap-2">
      <h2 id="landed-title" className="font-semibold">
        Where {viewer.id === owner.id ? 'you have' : `${owner.displayName.split(' ')[0]} has`} landed
      </h2>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Airports landed at: ${pts.map((p) => p.icao).join(', ')}`} className="block h-auto w-full rounded-[var(--radius-panel)] border border-hairline bg-chart-blue-tint/60">
        {pts.map((p) => {
          const [x, y] = place(p)
          return (
            <g key={p.icao} onPointerEnter={() => setFocus(p.icao)} onPointerLeave={() => setFocus(null)}>
              <circle cx={x} cy={y} r={7} className="fill-surface stroke-magenta" strokeWidth={2.5} />
              <circle cx={x} cy={y} r={2.5} className="fill-magenta" />
              {(focus === p.icao || pts.length <= 6) && (
                <text x={x + 10} y={y + 4} className="fill-ink font-ident text-[11px]">
                  {p.icao}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </section>
  )
}
