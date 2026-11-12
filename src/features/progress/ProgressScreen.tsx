import { can } from '../../domain/tiers'
import { useActive, useWorld } from '../../store/hooks'
import { AirportMark } from '../../ui/AirportMark'
import { ProGate } from '../../ui/ProGate'
import { ButtonLink, EmptyState, Ident, ScreenTitle } from '../../ui/primitives'

export function ProgressScreen() {
  const world = useWorld()
  const { account, access } = useActive()
  const mine = world.achievements.filter((a) => a.pilotId === account.id)
  const stamps = mine.filter((a) => a.kind === 'stamp')
  const badges = mine.filter((a) => a.kind === 'badge')

  return (
    <div className="flex flex-col gap-5">
      <ScreenTitle>Progress</ScreenTitle>

      {stamps.length === 0 ? (
        <EmptyState
          title="No stamps or badges yet"
          body="Every new airport you land at earns a stamp, and milestones like your first solo cross-country earn a badge. Log a flight to start your collection."
          action={<ButtonLink to="/log">Log flight</ButtonLink>}
        />
      ) : (
        <>
          <section aria-labelledby="stamps-title">
            <h2 id="stamps-title" className="mb-2 font-semibold">
              Airport stamps · {stamps.length}
            </h2>
            <ul className="grid grid-cols-3 gap-2">
              {stamps.map((s) => (
                <li key={s.code} className="flex flex-col items-center rounded-[var(--radius-panel)] border border-hairline bg-surface p-3 text-center">
                  <AirportMark size={44} />
                  <span className="mt-1 text-[16px] font-bold">
                    <Ident>{s.icao}</Ident>
                  </span>
                  <span className="line-clamp-1 text-[12px] text-ink-muted">{s.title}</span>
                </li>
              ))}
            </ul>
          </section>
          {badges.length > 0 && (
            <section aria-labelledby="badges-title">
              <h2 id="badges-title" className="mb-2 font-semibold">
                Badges
              </h2>
              <ul className="flex flex-wrap gap-2">
                {badges.map((b) => (
                  <li key={b.code} className="rounded-full border border-hairline bg-surface px-3 py-1 text-[14px] font-semibold">
                    {b.title}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {can(access, 'progress.xp') ? (
        <EmptyState title="XP and ranks are coming" body="Your Pilot Pro progress, pathways and challenges will appear here." />
      ) : (
        <ProGate plan="Pilot Pro">XP, ranks, pathways and challenges track your progress across every flight.</ProGate>
      )}
    </div>
  )
}
