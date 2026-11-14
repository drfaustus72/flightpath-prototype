import { useState } from 'react'
import type { WeekCount } from '../../domain/dashboard'

const W = 340
const H = 160
const PAD = { top: 16, right: 4, bottom: 24, left: 28 }
const BAR_MAX = 18

const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

function niceMax(n: number): number {
  if (n <= 4) return 4
  const step = n <= 10 ? 2 : n <= 20 ? 5 : 10
  return Math.ceil(n / step) * step
}

/**
 * Columns of flights tagged to the school, one per week. A single series, so the title names it
 * (no legend). Each column is focusable and shows its value on hover or focus; a table view
 * carries every value too.
 */
export function WeeklyFlightsChart({ weeks, title }: { weeks: WeekCount[]; title: string }) {
  const [active, setActive] = useState<number | null>(null)
  const max = niceMax(Math.max(0, ...weeks.map((w) => w.flights)))
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const band = plotW / Math.max(1, weeks.length)
  const barW = Math.min(BAR_MAX, band - 2)
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH
  const ticks = [0, max / 2, max]
  const last = weeks.length - 1
  const shown = active ?? last
  const shownWeek = weeks[shown]

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="font-semibold">{title}</figcaption>
      <p className="min-h-6 text-[14px] text-ink-muted" aria-live="polite">
        {shownWeek && (
          <>
            Week of {shortDate(shownWeek.weekStart)}: <span className="font-semibold text-ink">{shownWeek.flights}</span>{' '}
            {shownWeek.flights === 1 ? 'flight' : 'flights'}
          </>
        )}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group" aria-label={title} onMouseLeave={() => setActive(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-hairline)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-ink-muted)">
              {t}
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const cx = PAD.left + band * i + band / 2
          const h = Math.max(0, y(0) - y(w.flights))
          const r = Math.min(4, h / 2)
          const x0 = cx - barW / 2
          const top = y(w.flights)
          // Rounded data end, square at the baseline.
          const d =
            h === 0
              ? ''
              : `M${x0},${y(0)} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${y(0)} Z`
          return (
            <g
              key={w.weekStart}
              tabIndex={0}
              role="img"
              aria-label={`Week of ${shortDate(w.weekStart)}: ${w.flights} ${w.flights === 1 ? 'flight' : 'flights'}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="outline-none"
            >
              {/* The hit target is the whole column band, bigger than the bar. */}
              <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} fill="transparent" />
              {shown === i && <rect x={PAD.left + band * i + 1} y={PAD.top} width={band - 2} height={plotH} fill="var(--color-chart-blue-tint)" />}
              {d && <path d={d} fill="var(--color-chart-blue)" />}
            </g>
          )
        })}
        {[0, last].map((i) => {
          const w = weeks[i]
          if (!w) return null
          return (
            <text
              key={`label-${i}`}
              x={PAD.left + band * i + band / 2}
              y={H - 6}
              textAnchor={i === 0 ? 'start' : 'end'}
              fontSize={11}
              fill="var(--color-ink-muted)"
            >
              {shortDate(w.weekStart)}
            </text>
          )
        })}
      </svg>
      <details className="text-[14px]">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">Show as a table</summary>
        <table className="w-full text-left">
          <thead>
            <tr className="text-ink-muted">
              <th className="py-1 font-semibold">Week of</th>
              <th className="py-1 text-right font-semibold">Flights</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.weekStart} className="border-t border-hairline">
                <td className="py-1">{shortDate(w.weekStart)}</td>
                <td className="py-1 text-right tabular-nums">{w.flights}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
