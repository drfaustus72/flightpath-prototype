import type { MapPoint } from '../../domain/directory'

/** Tile-free fallback: airports placed on a plain chart, tappable. */
export function PointsSketch({ points, label, onSelect }: { points: readonly MapPoint[]; label: string; onSelect: (icao: string) => void }) {
  if (points.length === 0) return null
  const w = 340
  const h = 260
  const pad = 26
  const lats = points.map((p) => p.airport.lat)
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const kx = Math.cos((midLat * Math.PI) / 180)
  const xs = points.map((p) => p.airport.lon * kx)
  const spanX = Math.max(Math.max(...xs) - Math.min(...xs), 0.5)
  const spanY = Math.max(Math.max(...lats) - Math.min(...lats), 0.5)
  const scale = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY)
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2
  const cy = (Math.max(...lats) + Math.min(...lats)) / 2

  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="block h-auto w-full rounded-[var(--radius-panel)] border border-hairline bg-chart-blue-tint/60">
      {points.map((p) => {
        const x = w / 2 + (p.airport.lon * kx - cx) * scale
        const y = h / 2 - (p.airport.lat - cy) * scale
        const r = 5 + Math.min(p.clubs.length + p.cfis + p.pilots, 6)
        return (
          <g key={p.airport.icao} onClick={() => onSelect(p.airport.icao)} className="cursor-pointer">
            <circle cx={x} cy={y} r={r} className={p.clubs.length > 0 ? 'fill-magenta' : 'fill-chart-blue'} opacity={0.85} />
            {/* Labels flip to the left near the right edge so they stay inside the chart. */}
            <text x={x > w - 60 ? x - r - 3 : x + r + 3} y={y + 4} textAnchor={x > w - 60 ? 'end' : 'start'} className="fill-ink font-ident text-[10px]">
              {p.airport.icao}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
