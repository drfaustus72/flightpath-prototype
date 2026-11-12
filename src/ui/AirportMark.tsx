/**
 * The sectional-chart airport symbol: a ring with service ticks.
 * Flightpath's signature mark — used for home airports and, later, airport stamps.
 */
export function AirportMark({ size = 56, label }: { size?: number; label?: string }) {
  const ticks = [0, 60, 120, 180, 240, 300]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="text-magenta"
    >
      <circle cx="28" cy="28" r="15" fill="none" stroke="currentColor" strokeWidth="4" />
      {ticks.map((deg) => (
        <rect
          key={deg}
          x="26.5"
          y="4"
          width="3"
          height="7"
          rx="1"
          fill="currentColor"
          transform={`rotate(${deg} 28 28)`}
        />
      ))}
      <rect x="25.5" y="17" width="5" height="22" rx="1.5" fill="currentColor" transform="rotate(-30 28 28)" />
    </svg>
  )
}
