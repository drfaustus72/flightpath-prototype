import { acceptedTags, accountById } from '../../domain/social'
import type { Account, Flight } from '../../domain/types'
import { useWorld } from '../../store/hooks'
import { PersonLink } from './PersonLink'

/** "With Dan Whitaker (instructor) and Kim Alvarez": accepted tags only. */
/** Pass linked={false} inside another link (feed cards) to avoid nested links. */
export function FlightPeople({ flight, linked = true }: { flight: Flight; linked?: boolean }) {
  const world = useWorld()
  const instructor = flight.instructor?.status === 'accepted' ? accountById(world, flight.instructor.accountId) : undefined
  const others = acceptedTags(flight.flewWith).flatMap((t) => accountById(world, t.accountId) ?? [])
  if (!instructor && others.length === 0) return null
  const name = (a: Account) => (linked ? <PersonLink account={a} className="text-ink" /> : <span className="font-semibold text-ink">{a.displayName}</span>)
  return (
    <p className="text-[14px] text-ink-muted">
      With{' '}
      {instructor && (
        <>
          {name(instructor)} (instructor)
        </>
      )}
      {others.map((a, i) => (
        <span key={a.id}>
          {instructor || i > 0 ? (i === others.length - 1 ? ' and ' : ', ') : ''}
          {name(a)}
        </span>
      ))}
    </p>
  )
}
