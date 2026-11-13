import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Account } from '../../domain/types'
import { Avatar } from '../../ui/Avatar'

export function PersonRow({ person, detail, action }: { person: Account; detail: string; action?: ReactNode }) {
  return (
    <li className="flex min-h-14 items-center gap-3 rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-2">
      <Avatar account={person} />
      <Link to={`/u/${person.handle}`} className="min-w-0 flex-1">
        <span className="block font-semibold">{person.displayName}</span>
        <span className="block truncate text-[14px] text-ink-muted">{detail}</span>
      </Link>
      {action}
    </li>
  )
}
