import { MonitorPlay } from 'lucide-react'
import { useState } from 'react'
import type { MissionToVerify } from '../../domain/missions'
import { accountById } from '../../domain/social'
import type { Flight } from '../../domain/types'
import { useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Button, Panel } from '../../ui/primitives'
import { FlightLink } from '../flight/FlightLink'

/** A simulator session a member tagged to the school. Staff confirm it (never the pilot). */
export function SimSession({ flight }: { flight: Flight }) {
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

/** A mission waiting for this school's verification. `clubId` picks the school when a self-reported claim could go to several. */
export function MissionToVerifyRow({ item, clubId }: { item: MissionToVerify; clubId?: string }) {
  const world = useWorld()
  const verifyMission = useAppStore((s) => s.verifyMission)
  const verifyMissionClaim = useAppStore((s) => s.verifyMissionClaim)
  const [schoolAircraft, setSchoolAircraft] = useState(true)
  const pilot = accountById(world, item.pilotId)
  const { mission } = item

  if (item.kind === 'tracked') {
    const club = world.clubs.find((c) => c.id === item.flight.clubId)
    return (
      <li>
        <Panel className="flex flex-col gap-3">
          <p>
            <span className="font-semibold">{pilot?.displayName}</span> completed <span className="font-semibold">{mission.title}</span>.
          </p>
          <FlightLink flight={item.flight} />
          <p className="text-[13px] text-ink-muted">Verifying adds {mission.xp} XP at {club?.name}. Open the flight to check the track first.</p>
          <Button tone="primary" className="self-start" onClick={() => verifyMission(item.flight.id, mission.code)}>
            Verify {mission.title}
          </Button>
        </Panel>
      </li>
    )
  }

  const club = item.clubs.find((c) => c.id === clubId) ?? item.clubs[0]
  if (!club) return null
  return (
    <li>
      <Panel className="flex flex-col gap-3">
        <p>
          <span className="font-semibold">{pilot?.displayName}</span> says they flew <span className="font-semibold">{mission.title}</span>.
        </p>
        <p className="text-[13px] text-ink-muted">Self-reported, with no track. Check with them before verifying. Verifying adds {mission.xp} XP at {club.name} if it was flown in your aircraft.</p>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={schoolAircraft} onChange={(e) => setSchoolAircraft(e.target.checked)} className="size-5 accent-chart-blue" />
          Flown in a {club.name} aircraft
        </label>
        <Button tone="primary" className="self-start" onClick={() => verifyMissionClaim(item.pilotId, mission.code, club.id, schoolAircraft)}>
          Verify {mission.title}
        </Button>
      </Panel>
    </li>
  )
}
