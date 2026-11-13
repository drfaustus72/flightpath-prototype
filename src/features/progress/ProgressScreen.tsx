import { CalendarClock, PlaneLanding } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { type Badge, flightReviewStatus, landingsWithin, recognitionFor } from '../../domain/recognition'
import { can } from '../../domain/tiers'
import { useActive, useWorld } from '../../store/hooks'
import { AirportMark } from '../../ui/AirportMark'
import { ProGate } from '../../ui/ProGate'
import { ButtonLink, EmptyState, Ident, Panel, ScreenTitle } from '../../ui/primitives'
import { MilestonesPanel } from './MilestonesPanel'

const SOURCE_LABEL: Record<Badge['source'], string | null> = {
  tracked: null,
  self_reported: 'Self-reported',
  logbook_verified: 'Logbook verified',
}

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function ProgressScreen() {
  const world = useWorld()
  const { account, access } = useActive()
  // Captured once per visit so render stays pure.
  const [now] = useState(() => new Date())
  const r = recognitionFor(world, account.id)
  const activity = r.badges.filter((b) => b.family !== 'hours')
  const hours = r.badges.filter((b) => b.family === 'hours')
  const review = flightReviewStatus(account, now)
  const recentLandings = landingsWithin(world, account.id, 90, now)

  return (
    <div className="flex flex-col gap-6">
      <ScreenTitle>Progress</ScreenTitle>

      <dl className="grid grid-cols-4 gap-2">
        <Stat label="Flights" value={r.flights} />
        <Stat label="Airports" value={r.airports.length} />
        <Stat label="States" value={r.states.length} />
        <Stat label="Countries" value={r.countries.length} />
      </dl>

      <Panel className="flex flex-col gap-3">
        <h2 className="font-semibold">Recent flying</h2>
        <Row icon={<PlaneLanding size={18} aria-hidden="true" />} label="Landings in the last 90 days">
          <Ident>{recentLandings}</Ident>
        </Row>
        <Row icon={<CalendarClock size={18} aria-hidden="true" />} label="Flight review">
          {review.status === 'unknown' ? (
            <ButtonLink to="/profile">Add date</ButtonLink>
          ) : (
            <span
              className={review.status === 'overdue' ? 'font-semibold text-danger' : review.status === 'due_soon' ? 'font-semibold text-magenta' : ''}
            >
              {review.status === 'overdue' ? 'Was due ' : 'Due by '}
              {review.dueBy && fmtDate(review.dueBy)}
            </span>
          )}
        </Row>
        {review.status === 'due_soon' && review.daysLeft !== null && (
          <p className="rounded-[var(--radius-control)] bg-magenta-tint px-3 py-2 text-[14px] text-magenta">
            Your flight review is due in {review.daysLeft} days. Book it with your CFI.
          </p>
        )}
        <p className="text-[12px] text-ink-muted">
          From your logged flights and the date you entered. This is information, not a currency determination: check your logbook and endorsements.
        </p>
      </Panel>

      <MilestonesPanel />

      {r.airports.length === 0 ? (
        <EmptyState
          title="No airport stamps yet"
          body="Every new airport you land at earns a stamp, and Flightpath counts your takeoffs and landings there. Log a flight to start your collection."
          action={<ButtonLink to="/log">Log flight</ButtonLink>}
        />
      ) : (
        <section aria-labelledby="stamps-title">
          <h2 id="stamps-title" className="mb-2 font-semibold">
            Airports · {r.airports.length}
          </h2>
          <ul className="grid grid-cols-2 gap-2">
            {r.airports.map((a) => (
              <li key={a.icao} className="flex items-center gap-3 rounded-[var(--radius-panel)] border border-hairline bg-surface p-3">
                <span className="shrink-0">
                  <AirportMark size={40} />
                </span>
                <div className="min-w-0">
                  <p className="text-[17px] font-bold">
                    <Ident>{a.icao}</Ident>
                  </p>
                  <p className="truncate text-[12px] text-ink-muted">{a.name}</p>
                  <p className="text-[12px] text-ink-muted">
                    <Ident>{a.landings}</Ident> ldg · <Ident>{a.takeoffs}</Ident> t/o
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[14px] text-ink-muted">
            States: <Ident>{r.states.join(', ')}</Ident> · Countries: <Ident>{r.countries.join(', ')}</Ident>
          </p>
        </section>
      )}

      {activity.length > 0 && <BadgeList title="Badges" badges={activity} />}
      {hours.length > 0 && <BadgeList title="Hours" badges={hours} />}

      {can(access, 'progress.xp') ? (
        <EmptyState
          title="XP comes with missions"
          body="You earn XP by completing missions and achievements, once your school verifies them. Missions arrive in the next build."
        />
      ) : (
        <ProGate plan="School Pro">
          XP comes with membership at a School Pro flight school. Your school verifies the missions and achievements that
          earn it.
        </ProGate>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-hairline bg-surface px-2 py-3 text-center">
      <dd className="text-[22px] font-bold">
        <Ident>{value}</Ident>
      </dd>
      <dt className="text-[12px] text-ink-muted">{label}</dt>
    </div>
  )
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-ink-muted">
        {icon}
        {label}
      </span>
      <span className="text-right">{children}</span>
    </div>
  )
}

function BadgeList({ title, badges }: { title: string; badges: Badge[] }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 font-semibold">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {badges.map((b) => (
          <li key={b.code} className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1 text-[14px] font-semibold">
            {b.title}
            {SOURCE_LABEL[b.source] && <span className="text-[12px] font-normal text-ink-muted">{SOURCE_LABEL[b.source]}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
