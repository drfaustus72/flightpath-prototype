import { useState } from 'react'
import type { Account } from '../../domain/types'
import { useAppStore } from '../../store/storeContext'
import { Button, Ident, Panel } from '../../ui/primitives'

/** Logbook details the pilot enters (at sign-up, in the full product). Shown with their verification status. */
export function LogbookPanel({ account }: { account: Account }) {
  const updateLogbook = useAppStore((s) => s.updateLogbook)
  const [editing, setEditing] = useState(false)
  const [hours, setHours] = useState(String(account.totalHours))
  const [review, setReview] = useState(account.flightReviewOn ?? '')
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    const totalHours = Number(hours)
    if (hours.trim() === '' || !Number.isFinite(totalHours) || totalHours < 0) {
      setError('Enter your total hours as a number, for example 118.5.')
      return
    }
    updateLogbook({ totalHours, flightReviewOn: review === '' ? null : review })
    setError(null)
    setEditing(false)
  }

  if (!editing) {
    return (
      <Panel className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Logbook</h2>
          <Button onClick={() => setEditing(true)}>Edit</Button>
        </div>
        <p>
          <Ident>{account.totalHours.toLocaleString('en-US')}</Ident> total hours{' '}
          <span className="text-[13px] text-ink-muted">
            · {account.hoursSource === 'logbook_verified' ? 'Logbook verified' : 'Self-reported'}
          </span>
        </p>
        <p className="text-ink-muted">
          Last flight review: {account.flightReviewOn ? <Ident>{account.flightReviewOn}</Ident> : 'not entered'}
        </p>
      </Panel>
    )
  }

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-semibold">Logbook</h2>
      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-semibold">Total hours</span>
        <input
          inputMode="decimal"
          value={hours}
          onChange={(e) => {
            setHours(e.target.value)
            setError(null)
          }}
          className="min-h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3"
        />
        {error && (
          <span role="alert" className="text-[13px] text-danger">
            {error}
          </span>
        )}
        <span className="text-[13px] text-ink-muted">Changing your total marks it self-reported until you upload your logbook.</span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-semibold">Last flight review</span>
        <input
          type="date"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          className="min-h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3"
        />
      </label>
      <div className="flex gap-3">
        <Button onClick={() => setEditing(false)}>Cancel</Button>
        <Button tone="primary" onClick={save}>
          Save logbook
        </Button>
      </div>
    </Panel>
  )
}
