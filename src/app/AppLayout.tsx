import { Building2, Compass, Gauge, Inbox, Plus, Rows3, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { missionsToVerify } from '../domain/missions'
import { schoolQueueCount, schoolQueues } from '../domain/schoolAdmin'
import { inboxCount, inboxFor } from '../domain/signoffs'
import { isVerifiedCfi } from '../domain/tiers'
import { useActive, useWorld } from '../store/hooks'
import { PersonaSwitcher } from './PersonaSwitcher'

type Tab = { to: string; label: string; icon: ReactNode; count?: number }

const feed: Tab = { to: '/feed', label: 'Feed', icon: <Rows3 size={22} aria-hidden="true" /> }
const explore: Tab = { to: '/explore', label: 'Explore', icon: <Compass size={22} aria-hidden="true" /> }
const log: Tab = { to: '/log', label: 'Log flight', icon: <Plus size={26} strokeWidth={2.5} aria-hidden="true" /> }
const progress: Tab = { to: '/progress', label: 'Progress', icon: <Gauge size={22} aria-hidden="true" /> }
const profile: Tab = { to: '/profile', label: 'Profile', icon: <UserRound size={22} aria-hidden="true" /> }

/**
 * The fourth tab follows the persona's job (Progress stays reachable from the profile):
 *  - verified CFIs get an Inbox (sign-offs, tags, debriefs, plus their schools' join requests);
 *  - school admins who aren't CFIs get their School tools;
 *  - everyone else gets Progress.
 */
function useTabs(): Tab[] {
  const world = useWorld()
  const { account } = useActive()
  const schools = schoolQueues(world, account.id)
  if (isVerifiedCfi(account)) {
    // Missions and sim sessions already count in the CFI's own inbox; add only join requests.
    const joins = schools.reduce((n, q) => n + q.joinRequests.length, 0)
    const count = inboxCount(inboxFor(world, account.id)) + missionsToVerify(world, account.id).length + joins
    return [feed, explore, log, { to: '/inbox', label: 'Inbox', icon: <Inbox size={22} aria-hidden="true" />, count }, profile]
  }
  if (schools.length > 0) {
    const count = schools.reduce((n, q) => n + schoolQueueCount(q), 0)
    return [feed, explore, log, { to: '/school', label: 'School', icon: <Building2 size={22} aria-hidden="true" />, count }, profile]
  }
  return [feed, explore, log, progress, profile]
}

export function AppLayout() {
  const tabs = useTabs()
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-paper/95 px-4 py-2 backdrop-blur">
        <span className="text-[19px] font-extrabold tracking-tight">Flightpath</span>
        <PersonaSwitcher />
      </header>

      <main className="flex-1 px-4 pt-5 pb-28">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-lg border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-5">
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold ${
                    isActive ? 'text-chart-blue' : 'text-ink-muted'
                  }`
                }
              >
                {t.to === '/log' ? (
                  <span className="grid size-11 place-items-center rounded-full bg-magenta text-white">{t.icon}</span>
                ) : (
                  <span className="relative">
                    {t.icon}
                    {t.count !== undefined && t.count > 0 && (
                      <span aria-hidden="true" className="absolute -top-1.5 -right-2.5 min-w-5 rounded-full bg-magenta px-1 text-center text-[11px] leading-5 text-white">
                        {t.count}
                      </span>
                    )}
                  </span>
                )}
                <span className={t.to === '/log' ? 'sr-only' : undefined}>{t.label}</span>
                {t.count !== undefined && t.count > 0 && <span className="sr-only">, {t.count} waiting</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
