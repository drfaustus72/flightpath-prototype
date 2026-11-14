import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { PersonaSwitcher } from './PersonaSwitcher'

export type Tab = { to: string; label: string; icon: ReactNode; count?: number; end?: boolean; primary?: boolean }

/**
 * The app frame: header, content and a bottom tab bar. The personal app and a school space
 * use the same frame with different tabs and a different title.
 */
export function Shell({ title, actingAs, tabs, navLabel }: { title: ReactNode; actingAs: ReactNode; tabs: Tab[]; navLabel: string }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-hairline bg-paper/95 px-4 py-2 backdrop-blur">
        <div className="flex min-w-0 items-center gap-2">
          {title}
          {actingAs}
        </div>
        <PersonaSwitcher />
      </header>

      <main className="flex-1 px-4 pt-5 pb-28">
        <Outlet />
      </main>

      <nav
        aria-label={navLabel}
        className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-lg border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-1 text-[12px] font-semibold ${
                    isActive ? 'text-chart-blue' : 'text-ink-muted'
                  }`
                }
              >
                {t.primary ? (
                  <span className="grid size-11 place-items-center rounded-full bg-magenta text-white">{t.icon}</span>
                ) : (
                  <span className="relative">
                    {t.icon}
                    {t.count !== undefined && t.count > 0 && <CountDot count={t.count} />}
                  </span>
                )}
                <span className={t.primary ? 'sr-only' : undefined}>{t.label}</span>
                {t.count !== undefined && t.count > 0 && <span className="sr-only">, {t.count} waiting</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export function CountDot({ count }: { count: number }) {
  return (
    <span aria-hidden="true" className="absolute -top-1.5 -right-2.5 min-w-5 rounded-full bg-magenta px-1 text-center text-[11px] leading-5 text-white">
      {count}
    </span>
  )
}
