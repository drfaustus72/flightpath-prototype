import { Compass, Gauge, Plus, Rows3, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { PersonaSwitcher } from './PersonaSwitcher'

const tabs: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/feed', label: 'Feed', icon: <Rows3 size={22} aria-hidden="true" /> },
  { to: '/explore', label: 'Explore', icon: <Compass size={22} aria-hidden="true" /> },
  { to: '/log', label: 'Log flight', icon: <Plus size={26} strokeWidth={2.5} aria-hidden="true" /> },
  { to: '/progress', label: 'Progress', icon: <Gauge size={22} aria-hidden="true" /> },
  { to: '/profile', label: 'Profile', icon: <UserRound size={22} aria-hidden="true" /> },
]

export function AppLayout() {
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
                  t.icon
                )}
                <span className={t.to === '/log' ? 'sr-only' : undefined}>{t.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
