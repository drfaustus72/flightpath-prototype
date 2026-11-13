import { ThumbsUp } from 'lucide-react'
import { canGiveProps, hasGivenProps, propsCount } from '../../domain/social'
import type { Flight } from '../../domain/types'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'

/** Props: Flightpath's kudos. Your own flights show the count only. */
export function PropsButton({ flight }: { flight: Flight }) {
  const world = useWorld()
  const { account } = useActive()
  const toggleProps = useAppStore((s) => s.toggleProps)
  const count = propsCount(world, flight.id)
  const given = hasGivenProps(world, account.id, flight.id)
  const countText = <span className="font-ident tabular-nums">{count}</span>

  if (!canGiveProps(world, account.id, flight)) {
    return (
      <span className="inline-flex min-h-11 items-center gap-1.5 text-[14px] text-ink-muted">
        <ThumbsUp size={18} aria-hidden="true" />
        Props {countText}
      </span>
    )
  }
  return (
    <button
      type="button"
      aria-pressed={given}
      onClick={() => toggleProps(flight.id)}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] px-2 text-[14px] font-semibold ${
        given ? 'text-magenta' : 'text-ink-muted hover:text-ink'
      }`}
    >
      <ThumbsUp size={18} aria-hidden="true" fill={given ? 'currentColor' : 'none'} />
      Props {countText}
    </button>
  )
}
