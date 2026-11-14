import { CircleCheck, CirclePause } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { type MemberActivity, dataAsOf, schoolDashboard } from '../../domain/dashboard'
import { missionStatuses } from '../../domain/missions'
import { NUDGE_MAX } from '../../domain/schemas'
import { openNudge, sponsoredSeatCount } from '../../domain/schoolOps'
import { canInClub } from '../../domain/tiers'
import type { Club } from '../../domain/types'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Avatar } from '../../ui/Avatar'
import { ProGate } from '../../ui/ProGate'
import { Button, ButtonLink, EmptyState, Panel, ScreenTitle } from '../../ui/primitives'

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function useSchoolMembers(): { club: Club; members: MemberActivity[] } | null {
  const { clubId = '' } = useParams()
  const world = useWorld()
  const club = world.clubs.find((c) => c.id === clubId)
  const asOf = dataAsOf(world)
  if (!club || !asOf) return null
  return { club, members: schoolDashboard(world, club.id, asOf).members }
}

/** Status in words with an icon, never color alone. */
function StatusLabel({ m }: { m: MemberActivity }) {
  return m.status === 'active' ? (
    <span className="inline-flex items-center gap-1 text-[13px] text-ink-muted">
      <CircleCheck size={14} aria-hidden="true" className="text-chart-blue" /> Flying
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-magenta">
      <CirclePause size={14} aria-hidden="true" /> Gone quiet
    </span>
  )
}

const lastFlew = (m: MemberActivity) =>
  m.daysSince === null ? 'No flights with the school yet' : m.daysSince === 0 ? 'Flew today' : `Last flew ${m.daysSince} ${m.daysSince === 1 ? 'day' : 'days'} ago`

export function SchoolMembersScreen() {
  const data = useSchoolMembers()
  const { access } = useActive()
  const [params, setParams] = useSearchParams()
  if (!data) return null
  const { club, members } = data
  if (!canInClub(access, 'school.members', club.id)) {
    return <ProGate plan="School Pro">See each member’s last flight and XP, and send a nudge to pilots who’ve gone quiet.</ProGate>
  }
  const quietOnly = params.get('show') === 'quiet'
  const shown = quietOnly ? members.filter((m) => m.status === 'inactive') : members

  return (
    <div className="flex flex-col gap-4">
      <div>
        <ScreenTitle>Members</ScreenTitle>
        <p className="mt-1 text-[14px] text-ink-muted">{members.length} pilots. Last flights count only flights tagged to {club.name}.</p>
      </div>
      <div role="group" aria-label="Show" className="flex gap-2">
        <Button tone={quietOnly ? 'secondary' : 'primary'} aria-pressed={!quietOnly} onClick={() => setParams({})}>
          Everyone
        </Button>
        <Button tone={quietOnly ? 'primary' : 'secondary'} aria-pressed={quietOnly} onClick={() => setParams({ show: 'quiet' })}>
          Gone quiet
        </Button>
      </div>
      {shown.length === 0 ? (
        <p className="text-ink-muted">Everyone has flown with you in the last 30 days.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((m) => (
            <li key={m.account.id}>
              <Link
                to={`/school/${club.id}/members/${m.account.id}`}
                className="flex min-h-16 items-center gap-3 rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-2"
              >
                <Avatar account={m.account} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{m.account.displayName}</span>
                  <span className="text-[13px] text-ink-muted">{lastFlew(m)}</span>
                </span>
                <span className="flex flex-col items-end gap-0.5">
                  <StatusLabel m={m} />
                  <span className="text-[13px] tabular-nums text-ink-muted">{m.xp} XP</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function SchoolMemberScreen() {
  const { accountId = '' } = useParams()
  const data = useSchoolMembers()
  const { access } = useActive()
  if (!data) return null
  const { club, members } = data
  const m = members.find((x) => x.account.id === accountId)
  if (!canInClub(access, 'school.members', club.id) || !m) {
    return <EmptyState title="Not a member" body="This pilot isn’t a member of the school." action={<ButtonLink to={`/school/${club.id}/members`}>All members</ButtonLink>} />
  }

  return (
    <div className="flex flex-col gap-5">
      <Link to={`/school/${club.id}/members`} className="min-h-11 self-start py-2 text-[14px] font-semibold text-chart-blue">
        All members
      </Link>
      <div className="flex items-center gap-3">
        <Avatar account={m.account} size={56} />
        <div>
          <ScreenTitle>{m.account.displayName}</ScreenTitle>
          <StatusLabel m={m} />
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[15px]">
        <dt className="text-ink-muted">Last flight with the school</dt>
        <dd>{m.lastFlightAt ? shortDate(m.lastFlightAt) : 'None yet'}</dd>
        <dt className="text-ink-muted">Flights, last 30 days</dt>
        <dd className="tabular-nums">{m.recentFlights}</dd>
        <dt className="text-ink-muted">XP at {club.name}</dt>
        <dd className="tabular-nums">{m.xp}</dd>
        <dt className="text-ink-muted">Member since</dt>
        <dd>{shortDate(`${m.membership.startedOn}T12:00:00Z`)}</dd>
      </dl>
      <ButtonLink to={`/u/${m.account.handle}`}>Open profile</ButtonLink>
      <NudgePanel club={club} pilot={m} />
      <SeatPanel club={club} pilot={m} />
    </div>
  )
}

const DEFAULT_NOTE = 'We haven’t seen you in a while. Want to get back in the air? Book a plane and we’ll help you plan it.'

function NudgePanel({ club, pilot }: { club: Club; pilot: MemberActivity }) {
  const world = useWorld()
  const { access } = useActive()
  const send = useAppStore((s) => s.sendNudge)
  const [message, setMessage] = useState(DEFAULT_NOTE)
  const [missionCode, setMissionCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!canInClub(access, 'school.nudges', club.id)) return null
  const open = openNudge(world, club.id, pilot.account.id)
  const first = pilot.account.displayName.split(' ')[0] ?? pilot.account.displayName

  if (open) {
    const mission = world.missions.find((x) => x.code === open.missionCode)
    return (
      <Panel className="flex flex-col gap-1">
        <h2 className="font-semibold">Nudge sent</h2>
        <p className="text-[14px] text-ink-muted">
          {shortDate(open.at)}. {first} sees it on their Progress until they dismiss it.
        </p>
        <p className="mt-1">“{open.message}”</p>
        {mission && <p className="text-[14px]">Suggested mission: {mission.title}</p>}
      </Panel>
    )
  }

  // Suggest missions the pilot hasn't completed yet.
  const suggestions = missionStatuses(world, pilot.account.id).filter((s) => !s.complete && !s.mission.requirements.cfiOnly)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    try {
      send({ clubId: club.id, pilotId: pilot.account.id, message, missionCode: missionCode === '' ? null : missionCode })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The nudge couldn’t be sent')
      console.error('sendNudge failed', err)
    }
  }

  return (
    <Panel>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h2 className="font-semibold">Nudge {first}</h2>
        <label className="flex flex-col gap-1">
          <span className="text-[14px] font-semibold">Note</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={NUDGE_MAX}
            rows={3}
            className="rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[14px] font-semibold">Suggest a mission</span>
          <select
            value={missionCode}
            onChange={(e) => setMissionCode(e.target.value)}
            className="min-h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3"
          >
            <option value="">No mission</option>
            {suggestions.map((s) => (
              <option key={s.mission.code} value={s.mission.code}>
                {s.mission.title}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="text-[14px] text-danger">
            {error}
          </p>
        )}
        <Button tone="primary" type="submit" className="self-start">
          Send nudge
        </Button>
        <p className="text-[13px] text-ink-muted">Only {first} sees it. One note at a time: they dismiss it before you can send another.</p>
      </form>
    </Panel>
  )
}

function SeatPanel({ club, pilot }: { club: Club; pilot: MemberActivity }) {
  const world = useWorld()
  const { access } = useActive()
  const setSeat = useAppStore((s) => s.setSponsoredSeat)
  if (!canInClub(access, 'school.sponsorSeats', club.id)) return null
  const seats = sponsoredSeatCount(world, club.id)
  return (
    <Panel>
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          checked={pilot.membership.sponsoredPilotPro}
          onChange={(e) => setSeat({ clubId: club.id, pilotId: pilot.account.id, on: e.target.checked })}
          className="mt-1 size-5 accent-chart-blue"
        />
        <span>
          <span className="block font-semibold">Sponsored Pilot Pro seat</span>
          <span className="block text-[14px] text-ink-muted">
            Your school pays for their Pilot Pro while they’re a member.{' '}
            {seats === 1 ? '1 seat in use.' : `${seats} seats in use.`}
          </span>
        </span>
      </label>
    </Panel>
  )
}
