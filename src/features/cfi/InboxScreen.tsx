import { MonitorPlay } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'
import { SIGNOFF_DISCLAIMER, milestoneTitle } from '../../domain/milestones'
import { inboxCount, inboxFor, linkedStudentsOf, signoffClubFor } from '../../domain/signoffs'
import { accountById } from '../../domain/social'
import { isVerifiedCfi } from '../../domain/tiers'
import { missionsToVerify } from '../../domain/missions'
import type { Flight, Mission, SignoffRequest } from '../../domain/types'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Avatar } from '../../ui/Avatar'
import { Button, ButtonLink, EmptyState, Panel, ScreenTitle } from '../../ui/primitives'

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')

export function InboxScreen() {
  const world = useWorld()
  const { account } = useActive()

  if (!isVerifiedCfi(account)) {
    return (
      <EmptyState
        title="The inbox is for CFIs"
        body="Verified flight instructors see sign-off requests and debriefs here."
        action={<ButtonLink to="/feed">Go to feed</ButtonLink>}
      />
    )
  }

  const inbox = inboxFor(world, account.id)
  const missions = missionsToVerify(world, account.id)
  const students = linkedStudentsOf(world, account.id)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <ScreenTitle>Inbox</ScreenTitle>
        <p className="mt-1 text-[14px] text-ink-muted">Sign-offs are {SIGNOFF_DISCLAIMER.charAt(0).toLowerCase() + SIGNOFF_DISCLAIMER.slice(1)}</p>
      </div>

      {inboxCount(inbox) + missions.length === 0 && <EmptyState title="You’re all caught up" body="New sign-off requests, instructor tags and simulator sessions to confirm show up here." />}

      {inbox.milestoneRequests.length > 0 && (
        <Section title="Milestones to verify">
          {inbox.milestoneRequests.map((r) => (
            <MilestoneRequest key={r.id} request={r} />
          ))}
        </Section>
      )}

      {missions.length > 0 && (
        <Section title="Missions to verify">
          {missions.map(({ flight, mission }) => (
            <MissionToVerifyRow key={`${flight.id}-${mission.code}`} flight={flight} mission={mission} />
          ))}
        </Section>
      )}

      {inbox.tagRequests.length > 0 && (
        <Section title="Tagged you as instructor">
          {inbox.tagRequests.map((f) => (
            <TagRequest key={f.id} flight={f} />
          ))}
        </Section>
      )}

      {inbox.toSignOff.length > 0 && (
        <Section title="Flights to debrief and sign off">
          {inbox.toSignOff.map((f) => (
            <li key={f.id}>
              <FlightLink flight={f} />
            </li>
          ))}
        </Section>
      )}

      {inbox.simSessions.length > 0 && (
        <Section title="Simulator sessions to confirm">
          {inbox.simSessions.map((f) => (
            <SimSession key={f.id} flight={f} />
          ))}
        </Section>
      )}

      {students.length > 0 && (
        <Section title="Your students">
          {students.map((s) => (
            <li key={s.id}>
              <Link to={`/u/${s.handle}`} className="flex min-h-14 items-center gap-3 rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-2">
                <Avatar account={s} />
                <span className="font-semibold">{s.displayName}</span>
              </Link>
            </li>
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `inbox-${title.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="font-semibold">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  )
}

function FlightLink({ flight }: { flight: Flight }) {
  const world = useWorld()
  const pilot = accountById(world, flight.pilotId)
  return (
    <Link to={`/flights/${flight.id}`} className="flex min-h-14 flex-col justify-center rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-2">
      <span className="font-semibold">{flight.title}</span>
      <span className="text-[14px] text-ink-muted">
        {pilot?.displayName} · {day(flight.startedAt)}
      </span>
    </Link>
  )
}

function MilestoneRequest({ request }: { request: SignoffRequest }) {
  const world = useWorld()
  const signOffMilestone = useAppStore((s) => s.signOffMilestone)
  const decline = useAppStore((s) => s.declineSignoffRequest)
  const { account } = useActive()
  const [note, setNote] = useState('')
  const [schoolAircraft, setSchoolAircraft] = useState(true)
  const school = signoffClubFor(world, account.id, request.studentId)
  const student = accountById(world, request.studentId)
  const title = milestoneTitle(request.milestone)
  const noteId = `note-${request.id}`

  return (
    <li>
      <Panel className="flex flex-col gap-3">
        <p>
          <span className="font-semibold">{student?.displayName}</span> asks you to verify <span className="font-semibold">{title}</span>.
        </p>
        <div className="flex flex-col gap-1">
          <label htmlFor={noteId} className="text-[14px] text-ink-muted">
            Note for {student?.displayName.split(' ')[0]} (optional)
          </label>
          <input
            id={noteId}
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3"
          />
        </div>
        {school && (
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" checked={schoolAircraft} onChange={(e) => setSchoolAircraft(e.target.checked)} className="size-5 accent-chart-blue" />
            Flown in a {school.name} aircraft
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          <Button tone="primary" onClick={() => signOffMilestone(request.studentId, request.milestone, note, schoolAircraft)}>
            Sign off {title}
          </Button>
          <Button onClick={() => decline(request.id)}>Decline</Button>
        </div>
      </Panel>
    </li>
  )
}

function TagRequest({ flight }: { flight: Flight }) {
  const answerTag = useAppStore((s) => s.answerTag)
  return (
    <li className="flex flex-col gap-2">
      <FlightLink flight={flight} />
      <div className="flex gap-2">
        <Button tone="primary" onClick={() => answerTag(flight.id, true)} aria-label={`Accept tag on ${flight.title}`}>
          Accept
        </Button>
        <Button onClick={() => answerTag(flight.id, false)} aria-label={`Decline tag on ${flight.title}`}>
          Decline
        </Button>
      </div>
    </li>
  )
}

function SimSession({ flight }: { flight: Flight }) {
  const world = useWorld()
  const review = useAppStore((s) => s.reviewSimSession)
  const club = world.clubs.find((c) => c.id === flight.clubId)
  return (
    <li>
      <Panel className="flex flex-col gap-3">
        <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-chart-blue">
          <MonitorPlay size={14} aria-hidden="true" /> {flight.source.gpsSource ?? 'Simulator'} at {club?.name}
        </p>
        <FlightLink flight={flight} />
        <p className="text-[13px] text-ink-muted">Confirming records that this session took place in your school’s simulator. It isn’t an FAA logging of simulator time.</p>
        <div className="flex gap-2">
          <Button tone="primary" onClick={() => review(flight.id, 'confirmed')}>
            Confirm session
          </Button>
          <Button onClick={() => review(flight.id, 'declined')}>Decline</Button>
        </div>
      </Panel>
    </li>
  )
}

export function MissionToVerifyRow({ flight, mission }: { flight: Flight; mission: Mission }) {
  const world = useWorld()
  const verifyMission = useAppStore((s) => s.verifyMission)
  const club = world.clubs.find((c) => c.id === flight.clubId)
  return (
    <li>
      <Panel className="flex flex-col gap-3">
        <p>
          <span className="font-semibold">{accountById(world, flight.pilotId)?.displayName}</span> completed{' '}
          <span className="font-semibold">{mission.title}</span>.
        </p>
        <FlightLink flight={flight} />
        <p className="text-[13px] text-ink-muted">Verifying adds {mission.xp} XP at {club?.name}. Open the flight to check the track first.</p>
        <Button tone="primary" className="self-start" onClick={() => verifyMission(flight.id, mission.code)}>
          Verify {mission.title}
        </Button>
      </Panel>
    </li>
  )
}
