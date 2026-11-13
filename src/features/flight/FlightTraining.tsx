import { Lock } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { SIGNOFF_DISCLAIMER } from '../../domain/milestones'
import { DEBRIEF_MAX } from '../../domain/schemas'
import { activeSignoffForFlight, canReadDebrief, canRevoke, canSignOffFlight } from '../../domain/signoffs'
import { accountById } from '../../domain/social'
import type { Flight, Signoff } from '../../domain/types'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Button, Panel } from '../../ui/primitives'
import { SignoffBadge } from '../cfi/SignoffBadge'

/** Shown to someone tagged on the flight who hasn't answered yet. */
export function TagAnswer({ flight }: { flight: Flight }) {
  const world = useWorld()
  const { account } = useActive()
  const answerTag = useAppStore((s) => s.answerTag)
  const asInstructor = flight.instructor?.accountId === account.id && flight.instructor.status === 'pending'
  const asPeer = flight.flewWith.some((t) => t.accountId === account.id && t.status === 'pending')
  if (!asInstructor && !asPeer) return null
  const pilot = accountById(world, flight.pilotId)

  return (
    <Panel className="flex flex-col gap-3 border-chart-blue/40 bg-chart-blue-tint">
      <p>
        <span className="font-semibold">{pilot?.displayName ?? 'A pilot'}</span>{' '}
        {asInstructor ? 'tagged you as the instructor on this flight.' : 'tagged you as flying along on this flight.'}
      </p>
      {asInstructor && (
        <p className="text-[14px] text-ink-muted">Accepting shows the tag on the flight and lets you debrief and sign it off.</p>
      )}
      <div className="flex gap-2">
        <Button tone="primary" onClick={() => answerTag(flight.id, true)}>
          Accept tag
        </Button>
        <Button onClick={() => answerTag(flight.id, false)}>Decline</Button>
      </div>
    </Panel>
  )
}

export function FlightSignoff({ flight }: { flight: Flight }) {
  const world = useWorld()
  const { account } = useActive()
  const signOffFlight = useAppStore((s) => s.signOffFlight)
  const [note, setNote] = useState('')
  const signoff = activeSignoffForFlight(world, flight.id)

  if (signoff) {
    return (
      <Panel className="flex flex-col gap-2">
        <SignoffBadge signoff={signoff} />
        {signoff.note && <p className="max-w-[60ch]">“{signoff.note}”</p>}
        {canRevoke(account.id, signoff) && <RevokeForm signoff={signoff} />}
      </Panel>
    )
  }
  if (!canSignOffFlight(world, account.id, flight)) return null

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-semibold">Sign off this flight</h2>
      <p className="text-[14px] text-ink-muted">{SIGNOFF_DISCLAIMER} It's logged with your name and the time, and you can revoke it later.</p>
      <label className="flex flex-col gap-1 text-[14px] text-ink-muted">
        Note for the pilot (optional)
        <input
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3 text-[16px] text-ink"
        />
      </label>
      <Button tone="primary" className="self-start" onClick={() => signOffFlight(flight.id, note)}>
        Sign off flight
      </Button>
    </Panel>
  )
}

export function RevokeForm({ signoff }: { signoff: Signoff }) {
  const revokeSignoff = useAppStore((s) => s.revokeSignoff)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <Button tone="danger" className="self-start" onClick={() => setOpen(true)}>
        Revoke sign-off
      </Button>
    )
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (reason.trim().length === 0) {
      setError('Say why you are revoking it. The pilot sees this reason.')
      return
    }
    revokeSignoff(signoff.id, reason)
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={`revoke-${signoff.id}`} className="text-[14px] text-ink-muted">
        Reason for revoking
      </label>
      <input
        id={`revoke-${signoff.id}`}
        value={reason}
        maxLength={500}
        onChange={(e) => setReason(e.target.value)}
        aria-invalid={error !== null}
        aria-describedby={error ? `revoke-error-${signoff.id}` : undefined}
        className="min-h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3"
      />
      {error && (
        <p id={`revoke-error-${signoff.id}`} className="text-[14px] text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" tone="danger">
          Revoke
        </Button>
        <Button onClick={() => setOpen(false)}>Keep sign-off</Button>
      </div>
    </form>
  )
}

/** Private thread between the pilot and the accepted instructor. */
export function DebriefThread({ flight }: { flight: Flight }) {
  const world = useWorld()
  const { account } = useActive()
  const addDebrief = useAppStore((s) => s.addDebrief)
  const [text, setText] = useState('')
  if (!canReadDebrief(account.id, flight)) return null
  const messages = world.debriefs.filter((m) => m.flightId === flight.id).sort((a, b) => a.at.localeCompare(b.at))
  const other = accountById(world, account.id === flight.pilotId ? (flight.instructor?.accountId ?? '') : flight.pilotId)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim().length === 0) return
    addDebrief(flight.id, text)
    setText('')
  }

  return (
    <section aria-labelledby="debrief-title" className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-hairline bg-surface p-4">
      <div>
        <h2 id="debrief-title" className="flex items-center gap-1.5 font-semibold">
          <Lock size={16} aria-hidden="true" /> Debrief
        </h2>
        <p className="text-[13px] text-ink-muted">Only you and {other?.displayName ?? 'your instructor'} can see this.</p>
      </div>
      {messages.length === 0 ? (
        <p className="text-ink-muted">No debrief yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {messages.map((m) => (
            <li key={m.id} className={m.authorId === account.id ? 'pl-6' : 'pr-6'}>
              <p className="text-[13px] text-ink-muted">
                {m.authorId === account.id ? 'You' : accountById(world, m.authorId)?.displayName}
              </p>
              <p className={`rounded-[var(--radius-control)] px-3 py-2 ${m.authorId === account.id ? 'bg-chart-blue-tint' : 'bg-paper'}`}>{m.text}</p>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor="debrief-text" className="text-[14px] text-ink-muted">
          {account.id === flight.pilotId ? 'Reply' : 'Write a debrief'}
        </label>
        <textarea
          id="debrief-text"
          rows={3}
          maxLength={DEBRIEF_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2"
        />
        <Button type="submit" className="self-start" disabled={text.trim().length === 0}>
          Send
        </Button>
      </form>
    </section>
  )
}
