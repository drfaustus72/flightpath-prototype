import { Check, Compass, Flag } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import { adviceFor, pathwaySteps, suggestionAdvice } from '../../domain/advisor'
import { challengeProgress, entryFor, schoolChallengesFor } from '../../domain/challenges'
import { can } from '../../domain/tiers'
import type { Challenge } from '../../domain/types'
import { xpSummary } from '../../domain/xp'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { ProGate } from '../../ui/ProGate'
import { Button, ButtonLink, Ident, Panel } from '../../ui/primitives'

/** Rule-based suggestion. It suggests; the CFI decides (CLAUDE.md rule 6). */
export function AdvisorCard() {
  const world = useWorld()
  const { account, access } = useActive()
  // Without the advisor, a pilot still sees a mission their own CFI suggested.
  const advice = can(access, 'progress.advisor') ? adviceFor(world, account.id) : suggestionAdvice(world, account.id)
  if (!advice) return null

  return (
    <section aria-labelledby="advisor-title" className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-chart-blue/30 bg-chart-blue-tint p-4">
      <p id="advisor-title" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-chart-blue">
        <Compass size={16} aria-hidden="true" /> {advice.context}
      </p>
      <p className="text-[22px] leading-tight font-bold">{advice.mission.title}</p>
      <ul className="flex flex-col gap-1 text-[15px]">
        {advice.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {advice.beforeYouGo.length > 0 && (
        <div>
          <p className="text-[14px] font-semibold">Before you go</p>
          <ul className="list-disc pl-5 text-[15px]">
            {advice.beforeYouGo.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[14px] font-semibold">{advice.handoff}</p>
      <ButtonLink to={`/missions/${advice.mission.code}`} tone="primary">
        Open the mission briefing
      </ButtonLink>
    </section>
  )
}

export function PathwayPanel() {
  const world = useWorld()
  const { account, access } = useActive()
  const pathway = world.pathways[0]
  if (!pathway) return null
  if (!can(access, 'progress.pathways')) {
    return (
      <ProGate plan="Pilot Pro">
        Follow the {pathway.title} pathway: five missions from your first trip beyond the practice area to the long cross-country before
        your checkride.
      </ProGate>
    )
  }
  const steps = pathwaySteps(world, account.id, pathway)
  const done = steps.filter((s) => s.complete).length

  return (
    <section aria-labelledby="pathway-title" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="pathway-title" className="font-semibold">
          {pathway.title}
        </h2>
        <span className="text-[14px] text-ink-muted">
          <Ident>{done}</Ident> of <Ident>{steps.length}</Ident>
        </span>
      </div>
      <ol className="flex flex-col">
        {steps.map((s, i) => (
          <li key={s.mission.code} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`grid size-8 shrink-0 place-items-center rounded-full border-2 text-[13px] font-bold ${
                s.complete ? 'border-magenta bg-magenta text-white' : 'border-hairline bg-surface text-ink-muted'
              }`}
            >
              {s.complete ? <Check size={16} /> : i + 1}
            </span>
            <Link to={`/missions/${s.mission.code}`} className="flex min-h-12 flex-1 items-center justify-between gap-2 border-b border-hairline">
              <span className={s.complete ? 'font-semibold' : ''}>{s.mission.title}</span>
              <span className="text-[13px] text-ink-muted">{s.source === 'verified' ? 'Verified' : s.source === 'self_reported' ? 'Self-reported' : s.complete ? 'Complete' : ''}</span>
            </Link>
          </li>
        ))}
      </ol>
      <Link to="/missions" className="text-[14px] font-semibold text-chart-blue underline-offset-2 hover:underline">
        All missions
      </Link>
    </section>
  )
}

/** XP and rank per School Pro school. Discounts are a placeholder until counsel review (rule 8). */
export function XpPanel() {
  const world = useWorld()
  const { account, access } = useActive()
  if (!can(access, 'progress.xp')) {
    return (
      <ProGate plan="School Pro">
        XP comes with membership at a School Pro flight school. Your school verifies the missions and milestones that earn it.
      </ProGate>
    )
  }
  return (
    <>
      {xpSummary(world, account.id).map((s) => (
        <section key={s.club.id} aria-labelledby={`xp-${s.club.id}`} className="flex flex-col gap-3">
          <h2 id={`xp-${s.club.id}`} className="font-semibold">
            XP at {s.club.name}
          </h2>
          <Panel className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <p className="text-[22px] font-bold">{s.rank}</p>
              <p className="text-[22px] font-bold">
                <Ident>{s.xp.toLocaleString('en-US')}</Ident> <span className="text-[14px] font-semibold text-ink-muted">XP</span>
              </p>
            </div>
            {s.nextRank && (
              <>
                <div
                  className="h-2 overflow-hidden rounded-full bg-chart-blue-tint"
                  role="progressbar"
                  aria-label={`Progress to ${s.nextRank.name}`}
                  aria-valuemin={0}
                  aria-valuemax={s.xp + s.nextRank.xpToGo}
                  aria-valuenow={s.xp}
                >
                  <div className="h-full bg-chart-blue" style={{ width: `${(100 * s.xp) / (s.xp + s.nextRank.xpToGo)}%` }} />
                </div>
                <p className="text-[14px] text-ink-muted">
                  <Ident>{s.nextRank.xpToGo.toLocaleString('en-US')}</Ident> XP to {s.nextRank.name}
                </p>
              </>
            )}
            {s.entries.length === 0 ? (
              <p className="text-[14px] text-ink-muted">Complete a mission and have your school verify it to earn your first XP.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-hairline">
                {s.entries.map((e) => (
                  <li key={`${e.kind}-${e.title}-${e.at}`} className="flex justify-between py-2 text-[15px]">
                    <span>{e.title}</span>
                    <Ident>+{e.xp}</Ident>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[12px] text-ink-muted">
              XP stays with {s.club.name}: it doesn’t move to another school. Member perks are up to the school and aren’t in this build.
            </p>
          </Panel>
        </section>
      ))}
    </>
  )
}

export function ChallengesPanel() {
  const world = useWorld()
  const { account, access } = useActive()
  const school = schoolChallengesFor(world, account.id)
  const own = world.challenges.filter((c) => c.clubId === null)
  return (
    <section aria-labelledby="challenges-title" className="flex flex-col gap-2">
      <h2 id="challenges-title" className="font-semibold">
        Challenges
      </h2>
      {school.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="From your school">
          {school.map((c) => (
            <ChallengeRow key={c.code} challenge={c} />
          ))}
        </ul>
      )}
      {can(access, 'progress.challenges') ? (
        <ul className="flex flex-col gap-2">
          {own.map((c) => (
            <ChallengeRow key={c.code} challenge={c} />
          ))}
        </ul>
      ) : (
        <ProGate plan="Pilot Pro">Opt-in challenges like Five New Airports and the Three-State Passport. No leaderboards, no deadlines.</ProGate>
      )}
    </section>
  )
}

function ChallengeRow({ challenge }: { challenge: Challenge }) {
  const world = useWorld()
  const { account } = useActive()
  const join = useAppStore((s) => s.joinChallenge)
  const leave = useAppStore((s) => s.leaveChallenge)
  const entry = entryFor(world, account.id, challenge.code)
  const progress = entry ? challengeProgress(world, account.id, challenge, entry.joinedAt) : null
  const club = challenge.clubId === null ? undefined : world.clubs.find((c) => c.id === challenge.clubId)

  return (
    <li>
      <Panel className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            {club && <p className="text-[13px] font-semibold text-chart-blue">{club.name}</p>}
            <p className="font-semibold">{challenge.title}</p>
            <p className="text-[14px] text-ink-muted">{challenge.description}</p>
          </div>
          {progress?.done && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-magenta">
              <Flag size={14} aria-hidden="true" /> Done
            </span>
          )}
        </div>
        {progress && (
          <p className="text-[14px]">
            <Ident>{progress.current}</Ident> of <Ident>{progress.target}</Ident>
            {progress.items.length > 0 && challenge.kind !== 'no_go' && (
              <span className="text-ink-muted">
                {' · '}
                <Ident>{progress.items.join(' ')}</Ident>
              </span>
            )}
          </p>
        )}
        {entry && challenge.kind === 'no_go' && <NoGoForm />}
        <div>
          {entry ? (
            <Button onClick={() => leave(challenge.code)}>Leave challenge</Button>
          ) : (
            <Button onClick={() => join(challenge.code)}>Join challenge</Button>
          )}
        </div>
      </Panel>
    </li>
  )
}

function NoGoForm() {
  const world = useWorld()
  const { account } = useActive()
  const recordNoGo = useAppStore((s) => s.recordNoGo)
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (reason.trim().length === 0) {
      setError('Say briefly why you decided not to go.')
      return
    }
    const dest = to.trim().toUpperCase()
    if (dest !== '' && !world.airports.some((x) => x.icao === dest)) {
      setError(`${dest} isn’t an airport in this demo. Leave it blank or try another identifier.`)
      return
    }
    recordNoGo({ from: account.homeAirport, to: dest === '' ? null : dest, reason })
    setReason('')
    setTo('')
    setError(null)
    setSaved(true)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-[var(--radius-control)] bg-paper p-3">
      <p className="text-[14px] font-semibold">Record a no-go</p>
      <label className="flex flex-col gap-1 text-[14px] text-ink-muted">
        Where were you going? (optional)
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="e.g. KSBA"
          className="min-h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3 text-[16px] text-ink uppercase"
        />
      </label>
      <label className="flex flex-col gap-1 text-[14px] text-ink-muted">
        Why you didn’t go
        <textarea
          rows={2}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={error !== null}
          className="rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-[16px] text-ink"
        />
      </label>
      {error && <p className="text-[14px] text-danger">{error}</p>}
      {saved && <p className="text-[14px] text-chart-blue">Recorded. Good call.</p>}
      <Button type="submit" className="self-start">
        Record no-go
      </Button>
    </form>
  )
}
