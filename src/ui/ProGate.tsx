import type { ReactNode } from 'react'
import { Panel } from './primitives'

/**
 * Shown in place of a gated feature. Decides nothing itself:
 * callers check access with `can` / `canInClub` and render this when it's false.
 */
export function ProGate({ plan, children }: { plan: 'Pilot Pro' | 'CFI Pro' | 'School Pro'; children: ReactNode }) {
  return (
    <Panel className="border-dashed">
      <p className="font-semibold">Part of {plan}</p>
      <p className="mt-1 text-ink-muted">{children}</p>
    </Panel>
  )
}
