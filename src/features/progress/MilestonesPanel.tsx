import { useState } from 'react'
import { SIGNOFF_DISCLAIMER } from '../../domain/milestones'
import { canRequestSignoff, linkedCfisOf, milestonesFor } from '../../domain/signoffs'
import { accountById } from '../../domain/social'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Button } from '../../ui/primitives'
import { SignoffBadge } from '../cfi/SignoffBadge'
import type { MilestoneCode } from '../../domain/types'

/** Training milestones: self-reported until a linked CFI verifies them. */
export function MilestonesPanel() {
  const world = useWorld()
  const { account } = useActive()
  const claimMilestone = useAppStore((s) => s.claimMilestone)
  const requestSignoff = useAppStore((s) => s.requestSignoff)
  const all = milestonesFor(world, account.id)
  const milestones = all.filter((m) => m.claim || m.signoff)
  const unrecorded = all.filter((m) => !m.claim && !m.signoff)
  const cfis = linkedCfisOf(world, account.id)
  const [choice, setChoice] = useState<MilestoneCode | ''>('')

  return (
    <section aria-labelledby="milestones-title" className="flex flex-col gap-2">
      <h2 id="milestones-title" className="font-semibold">
        Training milestones
      </h2>
      {milestones.length === 0 && <p className="text-ink-muted">Record the milestones you’ve reached, then ask your CFI to verify them.</p>}
      {milestones.length > 0 && (
        <ul className="divide-y divide-hairline rounded-[var(--radius-panel)] border border-hairline bg-surface">
          {milestones.map((m) => {
            const requestedFrom = m.request ? accountById(world, m.request.cfiId) : undefined
            const askable = cfis.find((c) => canRequestSignoff(world, account.id, c.id, m.code))
            return (
              <li key={m.code} className="flex flex-col gap-2 px-4 py-3">
                <p className="font-semibold">{m.title}</p>
                {m.signoff ? (
                  <SignoffBadge signoff={m.signoff} compact />
                ) : m.claim ? (
                  <p className="text-[14px] text-ink-muted">
                    Self-reported
                    {requestedFrom && ` · Waiting for ${requestedFrom.displayName} to verify`}
                  </p>
                ) : null}
                {m.claim && !m.signoff && !m.request && askable && (
                  <Button className="self-start" onClick={() => requestSignoff(askable.id, m.code)}>
                    Ask {askable.displayName.split(' ')[0]} to verify
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {unrecorded.length > 0 && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (choice === '') return
            claimMilestone(choice)
            setChoice('')
          }}
        >
          <label htmlFor="milestone-choice" className="sr-only">
            Milestone to record
          </label>
          <select
            id="milestone-choice"
            value={choice}
            onChange={(e) => setChoice(e.target.value as MilestoneCode | '')}
            className="min-h-11 flex-1 rounded-[var(--radius-control)] border border-hairline bg-surface px-3"
          >
            <option value="">Choose a milestone…</option>
            {unrecorded.map((m) => (
              <option key={m.code} value={m.code}>
                {m.title}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={choice === ''}>
            Record
          </Button>
        </form>
      )}
      <p className="text-[12px] text-ink-muted">
        {cfis.length === 0 ? 'Link with a CFI to have milestones verified. ' : ''}
        CFI-verified: {SIGNOFF_DISCLAIMER}
      </p>
    </section>
  )
}
