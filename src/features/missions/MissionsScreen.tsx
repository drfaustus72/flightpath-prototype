import { ChevronRight, Flag } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { MISSION_LABELS, missionByCode, missionStatus, missionStatuses } from '../../domain/missions'
import { can } from '../../domain/tiers'
import { xpClubsOf } from '../../domain/xp'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { ProGate } from '../../ui/ProGate'
import { Button, ButtonLink, EmptyState, Ident, Panel, ScreenTitle } from '../../ui/primitives'

const THEMES: Record<string, string> = {
  coast: 'Island and coast',
  urban: 'Urban airspace',
  mountain: 'Mountains and high country',
  desert: 'Desert',
  valley: 'Valleys and wine country',
  training: 'Training',
}

export function MissionsScreen() {
  const world = useWorld()
  const { account, access } = useActive()
  const unlocked = can(access, 'progress.missions')
  const statuses = new Map(missionStatuses(world, account.id).map((s) => [s.mission.code, s]))

  return (
    <div className="flex flex-col gap-5">
      <div>
        <ScreenTitle>Missions</ScreenTitle>
        <p className="mt-1 text-ink-muted">Flights with a story and something to learn, from Southern California airports.</p>
      </div>
      {!unlocked && (
        <ProGate plan="Pilot Pro">
          Missions come with objectives, briefings and a pathway to follow. Flightpath checks your track and marks them complete.
        </ProGate>
      )}
      {Object.entries(THEMES).map(([theme, title]) => {
        const missions = world.missions.filter((m) => m.theme === theme)
        if (missions.length === 0) return null
        return (
          <section key={theme} aria-labelledby={`theme-${theme}`}>
            <h2 id={`theme-${theme}`} className="mb-2 font-semibold">
              {title}
            </h2>
            <ul className="flex flex-col gap-2">
              {missions.map((m) => {
                const s = statuses.get(m.code)
                const row = (
                  <>
                    <span className="min-w-0">
                      <span className="block font-semibold">{m.title}</span>
                      <span className="block text-[14px] text-ink-muted">
                        {MISSION_LABELS[m.label]}
                        {m.requirements.landAtAny && (
                          <>
                            {' · '}
                            <Ident>{m.requirements.landAtAny.join(' or ')}</Ident>
                          </>
                        )}
                      </span>
                    </span>
                    {unlocked && s?.complete ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-magenta">
                        <Flag size={14} aria-hidden="true" /> Complete
                      </span>
                    ) : (
                      unlocked && <ChevronRight size={20} aria-hidden="true" className="shrink-0" />
                    )}
                  </>
                )
                const cls = 'flex min-h-14 items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-2'
                return (
                  <li key={m.code}>
                    {unlocked ? (
                      <Link to={`/missions/${m.code}`} className={cls}>
                        {row}
                      </Link>
                    ) : (
                      <div className={cls}>{row}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export function MissionScreen() {
  const { code = '' } = useParams()
  const world = useWorld()
  const { account, access } = useActive()
  const mission = missionByCode(world, code)
  const claimMission = useAppStore((s) => s.claimMission)
  const withdrawClaim = useAppStore((s) => s.withdrawMissionClaim)

  if (!mission) {
    return <EmptyState title="Mission not found" body="It may have been retired." action={<ButtonLink to="/missions">All missions</ButtonLink>} />
  }
  if (!can(access, 'progress.missions')) {
    return (
      <div className="flex flex-col gap-4">
        <ScreenTitle>{mission.title}</ScreenTitle>
        <ProGate plan="Pilot Pro">Mission briefings, objectives and progress tracking come with Pilot Pro.</ProGate>
      </div>
    )
  }

  const status = missionStatus(world, account.id, mission)
  const xpSchool = xpClubsOf(world, account.id)[0]
  const sourceText = {
    verified: `Verified by ${xpSchool && status.verification?.clubId === xpSchool.id ? xpSchool.name : 'your school or instructor'}.`,
    tracked: xpSchool
      ? `Your track shows it. ${xpSchool.name} verifies it for XP when the flight is tagged to the school.`
      : 'Your track shows it.',
    self_reported: xpSchool ? `Self-reported. ${xpSchool.name} can verify it for XP after checking with you.` : 'Self-reported.',
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[14px] font-semibold text-chart-blue">{MISSION_LABELS[mission.label]}</p>
        <ScreenTitle>{mission.title}</ScreenTitle>
        <p className="mt-1 text-ink-muted">
          About {Math.round(mission.estMinutes / 30) / 2} hours
          {xpSchool && ` · ${mission.xp} XP at ${xpSchool.name} once verified`}
        </p>
      </div>

      {status.complete && status.source ? (
        <Panel className="border-magenta/30">
          <p className="inline-flex items-center gap-1.5 font-semibold text-magenta">
            <Flag size={16} aria-hidden="true" /> Complete
          </p>
          {status.flight && (
            <Link to={`/flights/${status.flight.id}`} className="mt-1 block underline underline-offset-2">
              {status.flight.title}
            </Link>
          )}
          <p className="mt-1 text-[14px] text-ink-muted">{sourceText[status.source]}</p>
          {status.source === 'self_reported' && (
            <Button className="mt-2" onClick={() => withdrawClaim(mission.code)}>
              Remove my report
            </Button>
          )}
        </Panel>
      ) : (
        <Panel className="flex flex-col gap-2">
          <p className="text-[14px] text-ink-muted">
            Flown it without recording a track? Report it yourself. It shows as self-reported{xpSchool ? `, and ${xpSchool.name} can verify it for XP` : ''}.
          </p>
          <Button className="self-start" onClick={() => claimMission(mission.code)}>
            I flew this
          </Button>
        </Panel>
      )}

      <p className="max-w-[60ch] text-[17px]">{mission.story}</p>

      <section aria-labelledby="objectives-title">
        <h2 id="objectives-title" className="mb-2 font-semibold">
          Objectives
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {mission.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </section>

      {mission.prerequisites.length > 0 && (
        <section aria-labelledby="prereq-title">
          <h2 id="prereq-title" className="mb-2 font-semibold">
            Before you go
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {mission.prerequisites.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[13px] text-ink-muted">
        {mission.requirements.cfiOnly
          ? 'A track can’t show this one: the CFI who flies it with you verifies it.'
          : 'Flightpath marks this complete from your track. Your school verifies it before it earns XP.'}{' '}
        This is a concept mission, not a flight plan: check current charts, NOTAMs and TFRs, weather and your aircraft, and fly it only
        when your CFI agrees. A completed mission is not an FAA endorsement or logged training.
      </p>
    </div>
  )
}
