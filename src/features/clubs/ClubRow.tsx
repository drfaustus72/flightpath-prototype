import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { clubPlanName } from '../../domain/clubs'
import type { Club } from '../../domain/types'
import { Ident } from '../../ui/primitives'

/** A school or club in a list. Plan is shown as a fact, never used to rank. */
export function ClubRow({ club, detail }: { club: Club; detail?: string }) {
  return (
    <li>
      <Link
        to={`/clubs/${club.id}`}
        className="flex min-h-14 items-center gap-3 rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-2"
      >
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-magenta-tint text-[13px] font-bold text-magenta">
          {club.initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{club.name}</span>
          <span className="block truncate text-[14px] text-ink-muted">
            {detail ?? (
              <>
                {clubPlanName(club)} · <Ident>{club.homeAirport}</Ident>
              </>
            )}
          </span>
        </span>
        <ChevronRight size={20} aria-hidden="true" className="shrink-0" />
      </Link>
    </li>
  )
}
