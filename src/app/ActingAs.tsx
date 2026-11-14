import { ArrowLeft, Building2 } from 'lucide-react'
import { Link } from 'react-router'
import { schoolQueueCount, schoolQueues } from '../domain/schoolAdmin'
import type { Club } from '../domain/types'
import { useActive, useWorld } from '../store/hooks'
import { CountDot } from './Shell'

const chip = 'relative flex min-h-11 min-w-0 items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 text-[14px] font-semibold'

/**
 * The "Acting as" switch. In the personal app it takes staff into their school's space (with a count of
 * what's waiting there); inside a school space it takes them back to their own account.
 * Nothing shows for people who aren't on a school's staff.
 */
export function ActingAs({ current }: { current?: Club }) {
  const world = useWorld()
  const { account } = useActive()

  if (current) {
    return (
      <Link to="/feed" className={chip} aria-label={`Act as yourself (${account.displayName})`}>
        <ArrowLeft size={16} aria-hidden="true" />
        You
      </Link>
    )
  }

  const queues = schoolQueues(world, account.id)
  if (queues.length === 0) return null
  const waiting = queues.reduce((n, q) => n + schoolQueueCount(q), 0)
  const only = queues.length === 1 ? queues[0] : undefined
  const to = only ? `/school/${only.club.id}` : '/school'
  const name = only ? only.club.name : 'Your schools'
  return (
    <Link to={to} className={chip} aria-label={`Act as ${name}${waiting > 0 ? `, ${waiting} waiting` : ''}`}>
      <Building2 size={16} aria-hidden="true" />
      <span className="truncate">{only ? 'School' : 'Schools'}</span>
      {waiting > 0 && <CountDot count={waiting} />}
    </Link>
  )
}
