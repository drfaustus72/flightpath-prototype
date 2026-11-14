import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router'
import { missionStatuses } from '../../domain/missions'
import { ASSIGNMENT_NOTE_MAX } from '../../domain/schemas'
import { type RosterRow, rosterFor } from '../../domain/roster'
import { can } from '../../domain/tiers'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Avatar } from '../../ui/Avatar'
import { ProGate } from '../../ui/ProGate'
import { Button, ButtonLink, EmptyState, Panel, ScreenTitle } from '../../ui/primitives'

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const first = (name: string) => name.split(' ')[0] ?? name

function useRoster(): RosterRow[] | null {
  const world = useWorld()
  const { account, access } = useActive()
  return can(access, 'cfi.roster') ? rosterFor(world, account.id) : null
}

function summary(r: RosterRow): string {
  const parts = [r.lastFlightAt ? `Last flew ${shortDate(r.lastFlightAt)}` : 'No flights yet']
  if (r.pathway) parts.push(`${r.pathway.done} of ${r.pathway.total} pathway steps`)
  return parts.join(' · ')
}

/** CFI Pro: the instructor's own students, the one who's flown least recently first. */
export function RosterScreen() {
  const rows = useRoster()
  if (!rows) {
    return (
      <ProGate plan="CFI Pro">
        A roster of your students with their progress, and missions you suggest that show up first in their advisor.
      </ProGate>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <div>
        <ScreenTitle>Your students</ScreenTitle>
        <p className="mt-1 text-[14px] text-ink-muted">Students who linked you as their CFI. Longest since they flew comes first.</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No students yet" body="Students who link you as their CFI show up here." />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.student.id}>
              <Link
                to={`/roster/${r.student.id}`}
                className="flex min-h-16 items-center gap-3 rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-2"
              >
                <Avatar account={r.student} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{r.student.displayName}</span>
                  <span className="text-[13px] text-ink-muted">{summary(r)}</span>
                </span>
                {r.openRequests > 0 && <span className="text-[13px] font-semibold text-magenta">{r.openRequests} to sign</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function RosterStudentScreen() {
  const { studentId = '' } = useParams()
  const rows = useRoster()
  const world = useWorld()
  const withdraw = useAppStore((s) => s.withdrawAssignment)
  if (!rows) return <RosterScreen />
  const r = rows.find((x) => x.student.id === studentId)
  if (!r) return <EmptyState title="Not your student" body="Only students who linked you as their CFI are on your roster." action={<ButtonLink to="/roster">Your students</ButtonLink>} />
  const title = (code: string) => world.missions.find((m) => m.code === code)?.title ?? code

  return (
    <div className="flex flex-col gap-5">
      <Link to="/roster" className="min-h-11 self-start py-2 text-[14px] font-semibold text-chart-blue">
        Your students
      </Link>
      <div className="flex items-center gap-3">
        <Avatar account={r.student} size={56} />
        <div>
          <ScreenTitle>{r.student.displayName}</ScreenTitle>
          <p className="text-[14px] text-ink-muted">{summary(r)}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[15px]">
        <dt className="text-ink-muted">Milestones you’ve signed</dt>
        <dd className="tabular-nums">{r.milestonesSigned}</dd>
        <dt className="text-ink-muted">Waiting for your sign-off</dt>
        <dd className="tabular-nums">{r.openRequests}</dd>
      </dl>
      <ButtonLink to={`/u/${r.student.handle}`}>Open profile</ButtonLink>

      {r.suggestions.length > 0 && (
        <section aria-labelledby="suggested-title" className="flex flex-col gap-2">
          <h2 id="suggested-title" className="font-semibold">
            You suggested
          </h2>
          <ul className="flex flex-col gap-2">
            {r.suggestions.map((a) => (
              <li key={a.id}>
                <Panel className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block font-semibold">{title(a.missionCode)}</span>
                    {a.note && <span className="block text-[14px] text-ink-muted">“{a.note}”</span>}
                  </span>
                  <Button onClick={() => withdraw(a.id)} aria-label={`Withdraw ${title(a.missionCode)}`}>
                    Withdraw
                  </Button>
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      )}
      <SuggestMission row={r} />
    </div>
  )
}

function SuggestMission({ row }: { row: RosterRow }) {
  const world = useWorld()
  const { access } = useActive()
  const assign = useAppStore((s) => s.assignMission)
  const [missionCode, setMissionCode] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!can(access, 'cfi.assignMissions')) return null
  const suggested = new Set(row.suggestions.map((a) => a.missionCode))
  const options = missionStatuses(world, row.student.id).filter((s) => !s.complete && !suggested.has(s.mission.code))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (missionCode === '') {
      setError('Pick a mission to suggest')
      return
    }
    try {
      assign({ studentId: row.student.id, missionCode, note })
      setMissionCode('')
      setNote('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The suggestion couldn’t be saved')
      console.error('assignMission failed', err)
    }
  }

  return (
    <Panel>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h2 className="font-semibold">Suggest a mission</h2>
        <p className="text-[14px] text-ink-muted">
          It shows first in {first(row.student.displayName)}’s advisor as your suggestion. You still decide when they’re ready to fly it.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-[14px] font-semibold">Mission</span>
          <select
            value={missionCode}
            onChange={(e) => setMissionCode(e.target.value)}
            className="min-h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3"
          >
            <option value="">Choose a mission</option>
            {options.map((s) => (
              <option key={s.mission.code} value={s.mission.code}>
                {s.mission.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[14px] font-semibold">Note (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={ASSIGNMENT_NOTE_MAX}
            className="min-h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3"
          />
        </label>
        {error && (
          <p role="alert" className="text-[14px] text-danger">
            {error}
          </p>
        )}
        <Button tone="primary" type="submit" className="self-start">
          Suggest mission
        </Button>
      </form>
    </Panel>
  )
}
