import { clubPlanName } from '../../domain/clubs'
import { isVerifiedCfi, planLabels } from '../../domain/tiers'
import { adminClubsOf } from '../../domain/world'
import { useActive, useWorld } from '../../store/hooks'
import { LogbookPanel } from './LogbookPanel'
import { LinkRow, ProfileLevelPicker, ShareProfile, WaitingForYou } from './OwnProfileSections'
import { LandedMap, ProfileFacts, ProfileHeader, TrophyCase } from './ProfileParts'

export function ProfileScreen() {
  const world = useWorld()
  const { account, access } = useActive()
  const adminClubs = adminClubsOf(world, account.id)

  return (
    <div className="flex flex-col gap-5">
      <ProfileHeader owner={account} badges={planLabels(access)} />
      <div className="flex flex-wrap gap-2">
        <ShareProfile />
      </div>

      <WaitingForYou />
      <ProfileLevelPicker />
      <ProfileFacts owner={account} />
      <LogbookPanel key={account.id} account={account} />
      <TrophyCase owner={account} />
      <LandedMap owner={account} />

      {isVerifiedCfi(account) && (
        <section aria-labelledby="own-flying-title" className="flex flex-col gap-2">
          <h2 id="own-flying-title" className="font-semibold">
            Your own flying
          </h2>
          <LinkRow to="/progress" title="Progress" detail="Stamps, badges, milestones and recent flying" />
        </section>
      )}

      {adminClubs.length > 0 && (
        <section aria-labelledby="manage-title">
          <h2 id="manage-title" className="mb-2 font-semibold">
            Schools you manage
          </h2>
          <ul className="flex flex-col gap-2">
            {adminClubs.map((c) => (
              <li key={c.id}>
                <LinkRow to={`/school/${c.id}`} title={c.name} detail={clubPlanName(c)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
