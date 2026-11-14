import { Compass, Gauge, Inbox, Plus, Rows3, UserRound } from 'lucide-react'
import { personalMissionsToVerify } from '../domain/schoolAdmin'
import { inboxCount, inboxFor } from '../domain/signoffs'
import { isVerifiedCfi } from '../domain/tiers'
import { useActive, useWorld } from '../store/hooks'
import { ActingAs } from './ActingAs'
import { Shell, type Tab } from './Shell'

const feed: Tab = { to: '/feed', label: 'Feed', icon: <Rows3 size={22} aria-hidden="true" /> }
const explore: Tab = { to: '/explore', label: 'Explore', icon: <Compass size={22} aria-hidden="true" /> }
const log: Tab = { to: '/log', label: 'Log flight', icon: <Plus size={26} strokeWidth={2.5} aria-hidden="true" />, primary: true }
const progress: Tab = { to: '/progress', label: 'Progress', icon: <Gauge size={22} aria-hidden="true" /> }
const profile: Tab = { to: '/profile', label: 'Profile', icon: <UserRound size={22} aria-hidden="true" /> }

/**
 * The fourth tab follows the persona's own job (Progress stays reachable from the profile):
 * verified CFIs get an Inbox of their own sign-offs, tags and debriefs; everyone else gets Progress.
 * School work lives in the school space, reached from the "Acting as" switch in the header.
 */
function useTabs(): Tab[] {
  const world = useWorld()
  const { account } = useActive()
  if (isVerifiedCfi(account)) {
    const count = inboxCount(inboxFor(world, account.id)) + personalMissionsToVerify(world, account.id).length
    return [feed, explore, log, { to: '/inbox', label: 'Inbox', icon: <Inbox size={22} aria-hidden="true" />, count }, profile]
  }
  return [feed, explore, log, progress, profile]
}

export function AppLayout() {
  return (
    <Shell
      title={<span className="text-[19px] font-extrabold tracking-tight">Flightpath</span>}
      actingAs={<ActingAs />}
      tabs={useTabs()}
      navLabel="Main"
    />
  )
}
