import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'

/** Aviation identifiers (ICAO codes, hours) set in the cockpit-display face. */
export function Ident({ children }: { children: ReactNode }) {
  return <span className="font-ident tracking-wide">{children}</span>
}

type Tone = 'primary' | 'secondary' | 'danger'

const toneClass: Record<Tone, string> = {
  primary: 'bg-magenta text-white hover:bg-magenta/90',
  secondary: 'bg-surface text-ink border border-hairline hover:border-ink-muted',
  danger: 'bg-surface text-danger border border-danger/40 hover:border-danger',
}

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50'

export function Button({ tone = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return <button type="button" className={`${base} ${toneClass[tone]} ${className}`} {...props} />
}

export function ButtonLink({ to, tone = 'secondary', children }: { to: string; tone?: Tone; children: ReactNode }) {
  return (
    <Link to={to} className={`${base} ${toneClass[tone]}`}>
      {children}
    </Link>
  )
}

export function PlanBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-chart-blue-tint px-2.5 py-0.5 text-[13px] font-semibold text-chart-blue">
      {children}
    </span>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[var(--radius-panel)] border border-hairline bg-surface p-4 ${className}`}>{children}</section>
}

export function ScreenTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-[26px] leading-tight font-bold tracking-tight">{children}</h1>
}

/** Empty screens point to the next action, not a mood. */
export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-10">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-[60ch] text-ink-muted">{body}</p>
      {action}
    </div>
  )
}
