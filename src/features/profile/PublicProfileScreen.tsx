import { Lock } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { canFollow, profileFlights } from '../../domain/social'
import { canSeeProfile, followStatus, isBlocked } from '../../domain/visibility'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Avatar } from '../../ui/Avatar'
import { Button, ButtonLink, EmptyState } from '../../ui/primitives'
import { FlightCard } from '../feed/FlightCard'
import { ReportButton } from '../social/ReportButton'
import { publicBadges } from './labels'
import { LandedMap, ProfileFacts, ProfileHeader, TrophyCase } from './ProfileParts'

export function PublicProfileScreen() {
  const { handle = '' } = useParams()
  const world = useWorld()
  const { account: viewer } = useActive()
  const owner = world.accounts.find((a) => a.handle === handle.toLowerCase())

  if (owner?.id === viewer.id) return <Navigate to="/profile" replace />

  // Blocked people look like missing ones, so a block isn't revealed.
  const blockedByOwner = owner ? world.blocks.some((b) => b.blockerId === owner.id && b.blockedId === viewer.id) : false
  if (!owner || blockedByOwner) {
    return (
      <EmptyState
        title="Pilot not found"
        body="Check the @handle, or find pilots in Explore."
        action={<ButtonLink to="/explore">Go to Explore</ButtonLink>}
      />
    )
  }

  const visible = canSeeProfile(world, viewer.id, owner.id)
  const iBlocked = isBlocked(world, viewer.id, owner.id)

  return (
    <div className="flex flex-col gap-5">
      {visible ? (
        <ProfileHeader owner={owner} badges={publicBadges(owner)} />
      ) : (
        <div className="flex items-center gap-4">
          <Avatar account={owner} size={64} />
          <div>
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">{owner.displayName}</h1>
            <p className="text-ink-muted">@{owner.handle}</p>
          </div>
        </div>
      )}

      <ProfileActions ownerId={owner.id} blocked={iBlocked} />

      {visible ? (
        <>
          <ProfileFacts owner={owner} />
          <TrophyCase owner={owner} />
          <LandedMap owner={owner} />
          <ProfileFlights ownerId={owner.id} />
        </>
      ) : (
        !iBlocked && (
          <p className="flex items-start gap-2 text-ink-muted">
            <Lock size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            This profile is private. Follow to ask {owner.displayName.split(' ')[0]} to approve you.
          </p>
        )
      )}
    </div>
  )
}

function ProfileActions({ ownerId, blocked }: { ownerId: string; blocked: boolean }) {
  const world = useWorld()
  const { account: viewer } = useActive()
  const follow = useAppStore((s) => s.follow)
  const unfollow = useAppStore((s) => s.unfollow)
  const block = useAppStore((s) => s.block)
  const unblock = useAppStore((s) => s.unblock)
  const status = followStatus(world, viewer.id, ownerId)
  const [confirmBlock, setConfirmBlock] = useState(false)

  if (blocked) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-ink-muted">You blocked this pilot. You don’t see each other’s profiles or flights.</p>
        <Button onClick={() => unblock(ownerId)}>Unblock</Button>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'accepted' && <Button onClick={() => unfollow(ownerId)}>Unfollow</Button>}
      {status === 'pending' && <Button onClick={() => unfollow(ownerId)}>Cancel follow request</Button>}
      {status === 'none' && canFollow(world, viewer.id, ownerId) && (
        <Button tone="primary" onClick={() => follow(ownerId)}>
          Follow
        </Button>
      )}
      {confirmBlock ? (
        <div className="flex w-full flex-col gap-2 rounded-[var(--radius-panel)] border border-danger/40 bg-surface p-3">
          <p>Block this pilot? You’ll stop following each other and won’t see each other’s profiles, flights or comments.</p>
          <div className="flex gap-2">
            <Button tone="danger" onClick={() => block(ownerId)}>
              Block pilot
            </Button>
            <Button onClick={() => setConfirmBlock(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button tone="danger" onClick={() => setConfirmBlock(true)}>
          Block
        </Button>
      )}
      <ReportButton target={{ kind: 'account', id: ownerId }} subject="profile" />
    </div>
  )
}

function ProfileFlights({ ownerId }: { ownerId: string }) {
  const world = useWorld()
  const { account: viewer } = useActive()
  const flights = profileFlights(world, viewer.id, ownerId)
  if (flights.length === 0) return null
  return (
    <section aria-labelledby="flights-title" className="flex flex-col gap-2">
      <h2 id="flights-title" className="font-semibold">
        Flights
      </h2>
      <ul className="flex flex-col gap-3">
        {flights.map((f) => (
          <li key={f.id}>
            <FlightCard flight={f} />
          </li>
        ))}
      </ul>
    </section>
  )
}
