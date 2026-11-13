import { BadgeCheck } from 'lucide-react'
import { SIGNOFF_DISCLAIMER } from '../../domain/milestones'
import { accountById } from '../../domain/social'
import type { Signoff } from '../../domain/types'
import { useWorld } from '../../store/hooks'

/** "CFI-verified · Dan Whitaker, Hawthorne Flight Academy", always with the platform-verification note. */
export function SignoffBadge({ signoff, compact = false }: { signoff: Signoff; compact?: boolean }) {
  const world = useWorld()
  const cfi = accountById(world, signoff.cfiId)
  const club = world.clubs.find((c) => c.id === signoff.clubId)
  const by = [cfi?.displayName, club?.name].filter(Boolean).join(', ')
  return (
    <div className="flex flex-col gap-0.5">
      <p className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-chart-blue">
        <BadgeCheck size={16} aria-hidden="true" />
        CFI-verified{by && ` · ${by}`}
      </p>
      {!compact && <p className="text-[12px] text-ink-muted">{SIGNOFF_DISCLAIMER}</p>}
    </div>
  )
}
