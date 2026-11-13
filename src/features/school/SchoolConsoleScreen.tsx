import { Link, Navigate, useParams } from 'react-router'
import { type ClubFeature, canInClub } from '../../domain/tiers'
import { pendingJoinRequests } from '../../domain/clubOps'
import { schoolQueue, schoolQueueCount, schoolQueues } from '../../domain/schoolAdmin'
import { activeMemberCount } from '../../domain/world'
import { MissionToVerifyRow, SimSession } from '../cfi/InboxScreen'
import { useActive, useWorld } from '../../store/hooks'
import { ProGate } from '../../ui/ProGate'
import { Button, ButtonLink, EmptyState, Ident, Panel, ScreenTitle } from '../../ui/primitives'
import { useAppStore } from '../../store/storeContext'

const proTools: { feature: ClubFeature; name: string }[] = [
  { feature: 'school.dashboard', name: 'Retention dashboard' },
  { feature: 'school.feed', name: 'Club feed' },
  { feature: 'school.brandedPosts', name: 'Branded posts and repost requests' },
  { feature: 'school.missionWall', name: 'Mission Wall' },
  { feature: 'school.customChallenges', name: 'Custom challenges' },
  { feature: 'school.sponsorSeats', name: 'Sponsored Pilot Pro seats' },
]

export function SchoolConsoleScreen() {
  const { clubId = '' } = useParams()
  const world = useWorld()
  const { access } = useActive()
  const club = world.clubs.find((c) => c.id === clubId)

  if (!club || !canInClub(access, 'school.editPage', clubId)) {
    return (
      <EmptyState
        title="You don't manage this school"
        body="Only a school's admins can open its tools. Switch to the school admin persona to see them."
        action={<ButtonLink to="/profile">Go to profile</ButtonLink>}
      />
    )
  }

  const isPro = canInClub(access, 'school.dashboard', clubId)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <ScreenTitle>{club.name}</ScreenTitle>
        <p className="text-ink-muted">
          {isPro ? 'School Pro' : 'School Basic'} · <Ident>{club.homeAirport}</Ident> ·{' '}
          {activeMemberCount(world, club.id)} members
        </p>
      </div>

      <Panel>
        <h2 className="font-semibold">School page</h2>
        <p className="mt-1 text-ink-muted">
          Edit your page, approve pilots who list you as their school, and confirm your staff CFIs.
        </p>
      </Panel>

      <JoinRequests clubId={club.id} />
      <SimQueue clubId={club.id} />
      {isPro && <MissionsQueue clubId={club.id} />}

      {isPro ? (
        <section aria-labelledby="pro-tools">
          <h2 id="pro-tools" className="mb-2 font-semibold">
            School Pro tools
          </h2>
          <ul className="flex flex-col gap-2">
            {proTools
              .filter((t) => canInClub(access, t.feature, clubId))
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
          A club feed, retention dashboard, branded posts, member perks and custom challenges help you keep
          pilots flying with your school.
        </ProGate>
      )}
    </div>
  )
}

function MissionsQueue({ clubId }: { clubId: string }) {
  const world = useWorld()
  const { account } = useActive()
  const club = world.clubs.find((c) => c.id === clubId)
  if (!club) return null
  const queue = schoolQueue(world, account.id, club).missions
  return (
    <section aria-labelledby="mission-queue" className="flex flex-col gap-2">
      <h2 id="mission-queue" className="font-semibold">
        Missions to verify
      </h2>
      {queue.length === 0 ? (
        <p className="text-ink-muted">Nothing waiting. Missions your members complete in your aircraft show up here.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {queue.map((item) => (
            <MissionToVerifyRow key={`${item.pilotId}-${item.mission.code}`} item={item} />
          ))}
        </ul>
      )}
    </section>
  )
}

function JoinRequests({ clubId }: { clubId: string }) {
  const world = useWorld()
  const { access } = useActive()
  const answer = useAppStore((s) => s.answerJoinRequest)
  if (!canInClub(access, 'school.approveMembers', clubId)) return null
  const requests = pendingJoinRequests(world, clubId)
  return (
    <section aria-labelledby="join-requests" className="flex flex-col gap-2">
      <h2 id="join-requests" className="font-semibold">
        Join requests
      </h2>
      {requests.length === 0 ? (
        <p className="text-ink-muted">No one is waiting.</p>
      ) : (
        <ul className="flex flex-col gap-2">
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
        </ul>
      )}
    </section>
  )
}

/** Simulator sessions members tagged to the school. Admins and staff CFIs confirm them (never the pilot). */
function SimQueue({ clubId }: { clubId: string }) {
  const world = useWorld()
  const { account } = useActive()
  const club = world.clubs.find((c) => c.id === clubId)
  if (!club) return null
  const sessions = schoolQueue(world, account.id, club).simSessions
  return (
    <section aria-labelledby="sim-queue" className="flex flex-col gap-2">
      <h2 id="sim-queue" className="font-semibold">
        Simulator sessions to confirm
      </h2>
      {sessions.length === 0 ? (
        <p className="text-ink-muted">Nothing waiting.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((f) => (
            <SimSession key={f.id} flight={f} />
          ))}
        </ul>
      )}
    </section>
  )
}

/** The School tab: straight to the school's tools, or a choice when an admin runs several. */
export function SchoolHomeScreen() {
  const world = useWorld()
  const { account } = useActive()
  const queues = schoolQueues(world, account.id)
  const only = queues.length === 1 ? queues[0] : undefined
  if (only) return <Navigate to={`/school/${only.club.id}`} replace />
  if (queues.length === 0) {
    return (
      <EmptyState title="You don't manage a school" body="School admins see their school's tools here." action={<ButtonLink to="/profile">Go to profile</ButtonLink>} />
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
