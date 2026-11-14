import { type FormEvent, useState } from 'react'
import { type SchoolChallengeKind, schoolChallenges } from '../../domain/schoolOps'
import { canInClub } from '../../domain/tiers'
import type { Club } from '../../domain/types'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Button, Panel } from '../../ui/primitives'

const KINDS: { kind: SchoolChallengeKind; label: string; goal: string }[] = [
  { kind: 'new_airports', label: 'New airports', goal: 'Airports to land at' },
  { kind: 'no_go', label: 'Good calls (no-gos)', goal: 'No-gos to record' },
]

const field = 'min-h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3'

/** School Pro admins make challenges for their members. Experience and good decisions only. */
export function ChallengeBuilder({ club }: { club: Club }) {
  const world = useWorld()
  const { access } = useActive()
  const create = useAppStore((s) => s.createSchoolChallenge)
  const remove = useAppStore((s) => s.removeSchoolChallenge)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<SchoolChallengeKind>('new_airports')
  const [target, setTarget] = useState('3')
  const [error, setError] = useState<string | null>(null)
  if (!canInClub(access, 'school.customChallenges', club.id)) return null
  const existing = schoolChallenges(world, club.id)
  const goal = KINDS.find((k) => k.kind === kind)?.goal ?? 'Goal'

  const submit = (e: FormEvent) => {
    e.preventDefault()
    try {
      create({ clubId: club.id, title, description, kind, target: Number(target) })
      setTitle('')
      setDescription('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The challenge couldn’t be created')
      console.error('createSchoolChallenge failed', err)
    }
  }

  return (
    <section aria-labelledby="school-challenges-title" className="flex flex-col gap-3">
      <h2 id="school-challenges-title" className="font-semibold">
        Challenges for your members
      </h2>
      <p className="text-[14px] text-ink-muted">Free for every member, including pilots without Pilot Pro. No leaderboards: each pilot sees only their own progress.</p>
      {existing.length > 0 && (
        <ul className="flex flex-col gap-2">
          {existing.map(({ challenge, joined }) => (
            <li key={challenge.code}>
              <Panel className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold">{challenge.title}</span>
                  <span className="block text-[14px] text-ink-muted">
                    {joined} {joined === 1 ? 'pilot' : 'pilots'} joined
                  </span>
                </span>
                <Button onClick={() => remove(challenge.code)} aria-label={`End ${challenge.title}`}>
                  End
                </Button>
              </Panel>
            </li>
          ))}
        </ul>
      )}
      <Panel>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <h3 className="font-semibold">New challenge</h3>
          <label className="flex flex-col gap-1">
            <span className="text-[14px] font-semibold">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} className={field} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[14px] font-semibold">Description</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[14px] font-semibold">Kind</span>
              <select value={kind} onChange={(e) => setKind(e.target.value as SchoolChallengeKind)} className={field}>
                {KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[14px] font-semibold">{goal}</span>
              <input type="number" min={1} max={50} value={target} onChange={(e) => setTarget(e.target.value)} className={field} />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-[14px] text-danger">
              {error}
            </p>
          )}
          <Button tone="primary" type="submit" className="self-start">
            Create challenge
          </Button>
        </form>
      </Panel>
    </section>
  )
}
