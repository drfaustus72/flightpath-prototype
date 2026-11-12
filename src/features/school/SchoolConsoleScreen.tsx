import { useParams } from 'react-router'
import { type ClubFeature, canInClub } from '../../domain/tiers'
import { activeMemberCount } from '../../domain/world'
import { useActive, useWorld } from '../../store/hooks'
import { ProGate } from '../../ui/ProGate'
import { ButtonLink, EmptyState, Ident, Panel, ScreenTitle } from '../../ui/primitives'

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
