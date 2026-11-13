import { Flag } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import type { Report } from '../../domain/types'
import { useAppStore } from '../../store/storeContext'
import { Button } from '../../ui/primitives'

const REASONS: { value: Report['reason']; label: string }[] = [
  { value: 'unsafe', label: 'Unsafe flying or advice' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam', label: 'Spam' },
  { value: 'impersonation', label: 'Pretending to be someone else' },
  { value: 'other', label: 'Something else' },
]

/** Records a report. The prototype has no moderation queue; the report is only stored. */
export function ReportButton({ target, subject }: { target: Report['target']; subject: string }) {
  const report = useAppStore((s) => s.report)
  const dialog = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState<Report['reason']>('unsafe')
  const [sent, setSent] = useState(false)
  const titleId = useId()

  if (sent) return <span className="text-[13px] text-ink-muted">Reported</span>

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 text-[13px] text-ink-muted hover:text-ink"
        aria-label={`Report ${subject}`}
      >
        <Flag size={16} aria-hidden="true" />
      </button>
      <dialog ref={dialog} aria-labelledby={titleId} className="m-auto w-[min(92vw,26rem)] rounded-[var(--radius-panel)] border border-hairline bg-surface p-5 text-ink backdrop:bg-ink/40">
        <form
          method="dialog"
          className="flex flex-col gap-3"
          onSubmit={() => {
            report(target, reason)
            setSent(true)
          }}
        >
          <h2 id={titleId} className="text-lg font-semibold">
            Report this {subject}
          </h2>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-[14px] text-ink-muted">What's wrong?</legend>
            {REASONS.map((r) => (
              <label key={r.value} className="flex min-h-11 items-center gap-3">
                <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
                {r.label}
              </label>
            ))}
          </fieldset>
          <div className="flex gap-2">
            <Button type="submit" tone="danger">
              Send report
            </Button>
            <Button onClick={() => dialog.current?.close()}>Cancel</Button>
          </div>
        </form>
      </dialog>
    </>
  )
}
