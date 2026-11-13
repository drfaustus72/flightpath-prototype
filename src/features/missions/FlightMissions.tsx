import { BadgeCheck, Flag } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import { canRevokeMissionVerification } from '../../domain/missionOps'
import { activeVerification, canVerifyMission, missionsCompletedOn } from '../../domain/missions'
import { accountById } from '../../domain/social'
import type { Flight, Mission, MissionVerification } from '../../domain/types'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Button, Panel } from '../../ui/primitives'

/**
 * "Mission complete" on a flight, the school's verification (which is what earns XP), and,
 * for the school's staff or the flight's instructor, the controls to verify or revoke.
 */
export function FlightMissions({ flight }: { flight: Flight }) {
  const world = useWorld()
  const { account } = useActive()
  const completed = missionsCompletedOn(world, flight)
  // CFI-only missions (practice diversion, SFRA) the instructor can verify on this flight.
  const instructorOnly = world.missions.filter((m) => m.requirements.cfiOnly && canVerifyMission(world, account.id, flight, m))
  const verifiedHere = world.missionVerifications.filter((v) => v.flightId === flight.id && v.revoked === null)
  const shown = new Map<string, Mission>()
  for (const m of completed) shown.set(m.code, m)
  for (const v of verifiedHere) {
    const m = world.missions.find((x) => x.code === v.missionCode)
    if (m) shown.set(m.code, m)
  }
  if (shown.size === 0 && instructorOnly.length === 0) return null

  return (
    <section aria-labelledby="missions-title" className="flex flex-col gap-3">
      <h2 id="missions-title" className="font-semibold">
        Missions
      </h2>
      {[...shown.values()].map((m) => (
        <MissionRow key={m.code} flight={flight} mission={m} verification={activeVerification(world, flight.pilotId, m.code) ?? null} />
      ))}
      {instructorOnly.length > 0 && (
        <Panel className="flex flex-col gap-2">
          <p className="font-semibold">Verify an instructor-only mission</p>
          <p className="text-[14px] text-ink-muted">These can’t be seen in a track. Verify the ones you flew with {accountById(world, flight.pilotId)?.displayName.split(' ')[0]} on this flight.</p>
          <VerifyButtons flight={flight} missions={instructorOnly} />
        </Panel>
      )}
    </section>
  )
}

function MissionRow({ flight, mission, verification }: { flight: Flight; mission: Mission; verification: MissionVerification | null }) {
  const world = useWorld()
  const { account } = useActive()
  const club = world.clubs.find((c) => c.id === verification?.clubId)
  const verifier = verification ? accountById(world, verification.byAccountId) : undefined
  const canVerify = !verification && canVerifyMission(world, account.id, flight, mission)

  return (
    <Panel className="flex flex-col gap-2 border-magenta/30">
      <p className="inline-flex items-center gap-1.5 font-semibold text-magenta">
        <Flag size={16} aria-hidden="true" /> Mission complete
      </p>
      <Link to={`/missions/${mission.code}`} className="text-[18px] font-bold underline-offset-2 hover:underline">
        {mission.title}
      </Link>
      {verification ? (
        <p className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-chart-blue">
          <BadgeCheck size={16} aria-hidden="true" />
          Verified by {verifier?.displayName}
          {club ? `, ${club.name} · +${mission.xp} XP there` : ''}
        </p>
      ) : (
        <p className="text-[14px] text-ink-muted">
          {account.id === flight.pilotId ? 'Waiting for your school to verify it. Verified missions earn XP at a School Pro school.' : 'Not verified yet.'}
        </p>
      )}
      {canVerify && <VerifyButtons flight={flight} missions={[mission]} />}
      {verification && canRevokeMissionVerification(world, account.id, verification.id) && <RevokeVerification verification={verification} />}
    </Panel>
  )
}

function VerifyButtons({ flight, missions }: { flight: Flight; missions: Mission[] }) {
  const world = useWorld()
  const verifyMission = useAppStore((s) => s.verifyMission)
  const club = world.clubs.find((c) => c.id === flight.clubId)
  return (
    <div className="flex flex-wrap gap-2">
      {missions.map((m) => (
        <Button key={m.code} tone="primary" onClick={() => verifyMission(flight.id, m.code)}>
          Verify {m.title}
          {club && club.plan === 'school_pro' && !m.requirements.cfiOnly ? ` for ${club.name}` : ''}
        </Button>
      ))}
    </div>
  )
}

function RevokeVerification({ verification }: { verification: MissionVerification }) {
  const revoke = useAppStore((s) => s.revokeMissionVerification)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputId = `revoke-mv-${verification.id}`
  if (!open) {
    return (
      <Button tone="danger" className="self-start" onClick={() => setOpen(true)}>
        Revoke verification
      </Button>
    )
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (reason.trim().length === 0) {
      setError('Say why. The pilot sees this reason, and the XP is removed.')
      return
    }
    revoke(verification.id, reason)
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-[14px] text-ink-muted">
        Reason for revoking
      </label>
      <input
        id={inputId}
        value={reason}
        maxLength={500}
        onChange={(e) => setReason(e.target.value)}
        aria-invalid={error !== null}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className="min-h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3"
      />
      {error && (
        <p id={`${inputId}-error`} className="text-[14px] text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" tone="danger">
          Revoke
        </Button>
        <Button onClick={() => setOpen(false)}>Keep verification</Button>
      </div>
    </form>
  )
}
