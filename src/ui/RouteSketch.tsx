/**
 * A lightweight route drawing with no map tiles: used on feed cards
 * and as the fallback when the interactive map can't load.
 */
export function RouteSketch({
  route,
  height = 140,
  label,
}: {
  route: readonly [number, number][]
  height?: number
  label: string
}) {
  const width = 320
  const pad = 14
  const lats = route.map((p) => p[1])
  const lons = route.map((p) => p[0])
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const kx = Math.cos((midLat * Math.PI) / 180) // equirectangular: shrink longitude by latitude
  const xs = lons.map((lon) => lon * kx)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...lats)
  const maxY = Math.max(...lats)
  const span = Math.max(maxX - minX, maxY - minY, 1e-6)
  const scale = Math.min((width - 2 * pad) / Math.max(maxX - minX, span * 0.2), (height - 2 * pad) / Math.max(maxY - minY, span * 0.2))
  const ox = (width - (maxX - minX) * scale) / 2
  const oy = (height - (maxY - minY) * scale) / 2
  const pts = route.map(([lon, lat]) => [ox + (lon * kx - minX) * scale, oy + (maxY - lat) * scale] as const)
  const start = pts[0]
  const end = pts.at(-1)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="block h-auto w-full rounded-[var(--radius-control)] bg-chart-blue-tint/60">
      <polyline
        points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none"
        className="stroke-chart-blue"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {start && <circle cx={start[0]} cy={start[1]} r="4.5" className="fill-surface stroke-magenta" strokeWidth="2.5" />}
      {end && <circle cx={end[0]} cy={end[1]} r="4.5" className="fill-magenta" />}
    </svg>
  )
}
