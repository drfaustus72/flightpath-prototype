import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { planLabels } from '../../domain/tiers'
import { clubPlanName } from '../../domain/clubs'
import { adminClubsOf, homeSchoolOf } from '../../domain/world'
import { useActive, useWorld } from '../../store/hooks'
import { AirportMark } from '../../ui/AirportMark'
import { Ident, Panel, PlanBadge } from '../../ui/primitives'
import { LogbookPanel } from './LogbookPanel'

const certificateNames: Record<string, string> = {
  student: 'Student',
  sport: 'Sport',
  recreational: 'Recreational',
  private: 'Private',
  instrument: 'Instrument',
  commercial: 'Commercial',
  multi_engine: 'Multi-engine',
  atp: 'ATP',
}

export function ProfileScreen() {
  const world = useWorld()
  const { account, access } = useActive()
  const airport = world.airports.find((a) => a.icao === account.homeAirport)
  const homeSchool = homeSchoolOf(world, account.id)
  const adminClubs = adminClubsOf(world, account.id)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[26px] leading-tight font-bold tracking-tight">{account.displayName}</h1>
        <p className="text-ink-muted">@{account.handle}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {planLabels(access).map((l) => (
            <PlanBadge key={l}>{l}</PlanBadge>
          ))}
        </div>
        {account.bio && <p className="mt-3 max-w-[60ch]">{account.bio}</p>}
        {account.isMinor && (
          <p className="mt-3 text-[14px] text-ink-muted">This profile is private. Only approved followers can see it.</p>
        )}
      </div>

      <Panel className="flex items-center gap-4">
        <AirportMark />
        <div>
          <p className="text-[13px] text-ink-muted">Home airport</p>
          <p className="text-[22px] font-bold">
            <Ident>{account.homeAirport}</Ident>
          </p>
          {airport && <p className="text-[14px] text-ink-muted">{airport.name}, {airport.city}</p>}
        </div>
      </Panel>

      <Panel>
        <p className="text-[13px] text-ink-muted">Home school</p>
        {homeSchool ? (
          <>
            <p className="text-[17px] font-semibold">{homeSchool.name}</p>
            <p className="text-[14px] text-ink-muted">
              {clubPlanName(homeSchool)} · <Ident>{homeSchool.homeAirport}</Ident>
            </p>
          </>
        ) : (
          <p className="text-ink-muted">No home school. Add one to show where you train.</p>
        )}
      </Panel>

      <dl>
        <Panel>
          <dt className="text-[13px] text-ink-muted">Certificates</dt>
          <dd className="font-semibold">
            {account.certificates.map((c) => certificateNames[c] ?? c).join(', ') || 'None yet'}
          </dd>
        </Panel>
      </dl>

      <LogbookPanel key={account.id} account={account} />

      {adminClubs.length > 0 && (
        <section aria-labelledby="manage-title">
          <h2 id="manage-title" className="mb-2 font-semibold">
            Schools you manage
          </h2>
          <ul className="flex flex-col gap-2">
            {adminClubs.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/school/${c.id}`}
                  className="flex min-h-14 items-center justify-between rounded-[var(--radius-panel)] border border-hairline bg-surface px-4"
                >
                  <span>
                    <span className="block font-semibold">{c.name}</span>
                    <span className="block text-[14px] text-ink-muted">{clubPlanName(c)}</span>
                  </span>
                  <ChevronRight size={20} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
