import { formatDuration } from '../../domain/flights'
import type { FlightStats as Stats } from '../../domain/types'
import { Ident } from '../../ui/primitives'

export function FlightStats({ stats, landings }: { stats: Stats; landings: number }) {
  const items: { label: string; value: string }[] = [
    { label: 'Distance', value: `${stats.distanceNm.toFixed(1)} nm` },
    { label: 'Time', value: formatDuration(stats.durationSec) },
    { label: 'Max altitude', value: stats.maxAltitudeFt === null ? '—' : `${stats.maxAltitudeFt.toLocaleString('en-US')} ft` },
    { label: 'Landings', value: String(landings) },
  ]
  return (
    <dl className="grid grid-cols-4 gap-2">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-[12px] text-ink-muted">{i.label}</dt>
          <dd className="text-[16px] font-bold whitespace-nowrap">
            <Ident>{i.value}</Ident>
          </dd>
        </div>
      ))}
    </dl>
  )
}
