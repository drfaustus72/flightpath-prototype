import { useParams } from 'react-router'
import { type ClubFeature, canInClub } from '../../domain/tiers'
import { pendingJoinRequests } from '../../domain/clubOps'
import { missionsToVerify } from '../../domain/missions'
import { activeMemberCount } from '../../domain/world'
import { MissionToVerifyRow } from '../cfi/InboxScreen'
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
  const queue = missionsToVerify(world, account.id).filter((x) =>
    x.kind === 'tracked' ? x.flight.clubId === clubId : x.clubs.some((c) => c.id === clubId),
  )
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
