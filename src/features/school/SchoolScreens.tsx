import type { ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { clubPlanName } from '../../domain/clubs'
import { dataAsOf, schoolDashboard } from '../../domain/dashboard'
import { pendingJoinRequests } from '../../domain/clubOps'
import { schoolQueue, schoolQueueCount, schoolQueues } from '../../domain/schoolAdmin'
import type { Club } from '../../domain/types'
import { type ClubFeature, canInClub } from '../../domain/tiers'
import { activeMemberCount } from '../../domain/world'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { ProGate } from '../../ui/ProGate'
import { Button, ButtonLink, EmptyState, Ident, Panel, ScreenTitle } from '../../ui/primitives'
import { MissionToVerifyRow, SimSession } from './QueueRows'
import { WallManager } from './WallManager'
import { WeeklyFlightsChart } from './WeeklyFlightsChart'

/** The school for the current /school/:clubId route. SchoolLayout has already checked staff access. */
function useSchool(): Club | undefined {
  const { clubId = '' } = useParams()
  return useWorld().clubs.find((c) => c.id === clubId)
}

/** /school/:clubId opens the dashboard on School Pro, otherwise the queue. */
export function SchoolIndex() {
  const { clubId = '' } = useParams()
  const { access } = useActive()
  return <Navigate to={canInClub(access, 'school.dashboard', clubId) ? 'dashboard' : 'queue'} replace />
}

const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export function SchoolDashboardScreen() {
  const club = useSchool()
  const world = useWorld()
  const { access } = useActive()
  if (!club) return null
  if (!canInClub(access, 'school.dashboard', club.id)) {
    return (
      <ProGate plan="School Pro">
        See who’s flying with your school, who has gone quiet, and how many flights members tag to you each week.
      </ProGate>
    )
  }
  const asOf = dataAsOf(world)
  if (!asOf) return <EmptyState title="No flights yet" body="When members tag flights to your school, their activity shows up here." />
  const d = schoolDashboard(world, club.id, asOf)
  const quiet = d.members.filter((m) => m.status === 'inactive')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <ScreenTitle>Dashboard</ScreenTitle>
        <p className="mt-1 text-[14px] text-ink-muted">
          As of {longDate(d.asOf)}. Counts only flights pilots chose to tag to {club.name}.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <StatTile label="Flying in the last 30 days" value={d.active} detail={`of ${d.members.length} members`} />
        <StatTile label="Gone quiet" value={d.inactive} detail="no flight in 30+ days" />
        <StatTile label="Missions verified" value={d.missionsVerified} detail="last 30 days" />
        <StatTile label="Milestone requests" value={d.openMilestoneRequests} detail="waiting for your CFIs" />
      </dl>

      <Panel>
        <WeeklyFlightsChart weeks={d.weekly} title="Flights tagged to the school, per week" />
      </Panel>

      <section aria-labelledby="quiet-title" className="flex flex-col gap-2">
        <h2 id="quiet-title" className="font-semibold">
          Gone quiet
        </h2>
        {quiet.length === 0 ? (
          <p className="text-ink-muted">Everyone has flown with you in the last 30 days.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {quiet.map((m) => (
              <li key={m.account.id}>
                <Link
                  to={`/school/${club.id}/members/${m.account.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-2"
                >
                  <span className="font-semibold">{m.account.displayName}</span>
                  <span className="text-[14px] text-ink-muted">
                    {m.daysSince === null ? 'No flights yet' : `Last flew ${m.daysSince} days ago`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function StatTile({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="flex flex-col rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-3">
      <dt className="text-[14px] text-ink-muted">{label}</dt>
      <dd className="text-[28px] font-semibold tabular-nums leading-tight">{value}</dd>
      <dd className="text-[13px] text-ink-muted">{detail}</dd>
    </div>
  )
}

export function SchoolQueueScreen() {
  const club = useSchool()
  const world = useWorld()
  const { account } = useActive()
  if (!club) return null
  const queue = schoolQueue(world, account.id, club)
  const isPro = club.plan === 'school_pro'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <ScreenTitle>Queue</ScreenTitle>
        <p className="mt-1 text-ink-muted">
          {schoolQueueCount(queue) === 0 ? 'Nothing is waiting for the school.' : 'Waiting for someone at the school.'}
        </p>
      </div>
      <JoinRequests club={club} />
      {isPro && (
        <QueueSection id="mission-queue" title="Missions to verify" empty="Nothing waiting. Missions your members complete in your aircraft show up here.">
          {queue.missions.map((item) => (
            <MissionToVerifyRow key={`${item.pilotId}-${item.mission.code}`} item={item} clubId={club.id} />
          ))}
        </QueueSection>
      )}
      <QueueSection id="sim-queue" title="Simulator sessions to confirm" empty="Nothing waiting.">
        {queue.simSessions.map((f) => (
          <SimSession key={f.id} flight={f} />
        ))}
      </QueueSection>
    </div>
  )
}

function QueueSection({ id, title, empty, children }: { id: string; title: string; empty: string; children: ReactNode[] }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="font-semibold">
        {title}
      </h2>
      {children.length === 0 ? <p className="text-ink-muted">{empty}</p> : <ul className="flex flex-col gap-2">{children}</ul>}
    </section>
  )
}

function JoinRequests({ club }: { club: Club }) {
  const world = useWorld()
  const { access } = useActive()
  const answer = useAppStore((s) => s.answerJoinRequest)
  if (!canInClub(access, 'school.approveMembers', club.id)) return null
  const requests = pendingJoinRequests(world, club.id)
  return (
    <QueueSection id="join-requests" title="Join requests" empty="No one is waiting.">
      {requests.map((m) => {
        const who = world.accounts.find((a) => a.id === m.accountId)
        return (
          <li key={m.id}>
            <Panel className="flex flex-col gap-2">
              <p>
                <span className="font-semibold">{who?.displayName}</span> wants to join.
              </p>
              <div className="flex gap-2">
                <Button tone="primary" onClick={() => answer(m.id, true)} aria-label={`Approve ${who?.displayName}`}>
                  Approve
                </Button>
                <Button onClick={() => answer(m.id, false)} aria-label={`Decline ${who?.displayName}`}>
                  Decline
                </Button>
              </div>
            </Panel>
          </li>
        )
      })}
    </QueueSection>
  )
}

const proTools: { feature: ClubFeature; name: string }[] = [
  { feature: 'school.feed', name: 'Club feed' },
  { feature: 'school.brandedPosts', name: 'Branded posts' },
  { feature: 'school.customChallenges', name: 'Custom challenges' },
  { feature: 'school.sponsorSeats', name: 'Sponsored Pilot Pro seats' },
]

/** The school's public page as staff see it, with what admins can change. */
export function SchoolPageScreen() {
  const club = useSchool()
  const world = useWorld()
  const { access } = useActive()
  if (!club) return null
  const isAdmin = canInClub(access, 'school.editPage', club.id)
  const isPro = club.plan === 'school_pro'

  return (
    <div className="flex flex-col gap-5">
      <div>
        <ScreenTitle>{club.name}</ScreenTitle>
        <p className="text-ink-muted">
          {clubPlanName(club)} · <Ident>{club.homeAirport}</Ident> · {activeMemberCount(world, club.id)} members
        </p>
      </div>
      <div>
        <ButtonLink to={`/clubs/${club.id}`}>See the public page</ButtonLink>
      </div>

      {isAdmin ? (
        <Panel>
          <h2 className="font-semibold">Your page</h2>
          <p className="mt-1 text-ink-muted">Edit your page, approve pilots who list you as their school, and confirm your staff CFIs.</p>
        </Panel>
      ) : (
        <p className="text-ink-muted">Your school’s admins edit this page. As a staff CFI you work the queue.</p>
      )}

      {isAdmin && isPro && <WallManager club={club} />}

      {isAdmin &&
        (isPro ? (
          <section aria-labelledby="pro-tools">
            <h2 id="pro-tools" className="mb-2 font-semibold">
              School Pro tools
            </h2>
            <ul className="flex flex-col gap-2">
              {proTools
                .filter((t) => canInClub(access, t.feature, club.id))
                .map((t) => (
                  <li key={t.feature}>
                    <Panel>
                      <p className="font-semibold">{t.name}</p>
                      <p className="text-[14px] text-ink-muted">Not in this build yet.</p>
                    </Panel>
                  </li>
                ))}
            </ul>
          </section>
        ) : (
          <ProGate plan="School Pro">
            A retention dashboard, member nudges, branded posts, the Mission Wall and custom challenges help you keep pilots
            flying with your school.
          </ProGate>
        ))}
    </div>
  )
}

/** /school: straight into the school's space, or a choice when someone is on staff at several. */
export function SchoolHomeScreen() {
  const world = useWorld()
  const { account } = useActive()
  const queues = schoolQueues(world, account.id)
  const only = queues.length === 1 ? queues[0] : undefined
  if (only) return <Navigate to={`/school/${only.club.id}`} replace />
  if (queues.length === 0) {
    return (
      <EmptyState title="You’re not on a school’s staff" body="School admins and staff CFIs act as their school from here." action={<ButtonLink to="/profile">Go to profile</ButtonLink>} />
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <ScreenTitle>Your schools</ScreenTitle>
      <ul className="flex flex-col gap-2">
        {queues.map((q) => (
          <li key={q.club.id}>
            <Link
              to={`/school/${q.club.id}`}
              className="flex min-h-14 items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-2"
            >
              <span className="font-semibold">{q.club.name}</span>
              <span className="text-[14px] text-ink-muted">{schoolQueueCount(q)} waiting</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
