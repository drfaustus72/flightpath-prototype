import { useSearchParams } from 'react-router'
import { RADII_NM, type RadiusNm, nearby } from '../../domain/directory'
import type { TrainingOffered } from '../../domain/types'
import { useActive, useWorld } from '../../store/hooks'
import { ButtonLink, Ident, ScreenTitle } from '../../ui/primitives'
import { ClubRow } from '../clubs/ClubRow'
import { PersonRow } from '../social/PersonRow'

const TRAINING: { value: TrainingOffered; label: string }[] = [
  { value: 'private', label: 'Private' },
  { value: 'instrument', label: 'Instrument' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'multi_engine', label: 'Multi-engine' },
  { value: 'cfi', label: 'CFI' },
  { value: 'tailwheel', label: 'Tailwheel' },
]

const fmtNm = (nm: number) => (nm < 0.5 ? 'on the field' : `${Math.round(nm)} nm`)

/** "Schools and CFIs near KHHR": ordered by distance, never by plan. */
export function NearbyScreen() {
  const world = useWorld()
  const { account } = useActive()
  const [params, setParams] = useSearchParams()
  const from = (params.get('from') ?? account.homeAirport).toUpperCase()
  const radius = (RADII_NM as readonly number[]).includes(Number(params.get('nm'))) ? (Number(params.get('nm')) as RadiusNm) : 25
  const training = (TRAINING.find((t) => t.value === params.get('training'))?.value ?? null) as TrainingOffered | null
  const airport = world.airports.find((a) => a.icao === from)
  const result = nearby(world, account.id, from, radius, training)
  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value === null) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <ScreenTitle>
          Schools and CFIs near <Ident>{from}</Ident>
        </ScreenTitle>
        {airport && <p className="text-ink-muted">{airport.name}</p>}
      </div>

      <fieldset>
        <legend className="mb-2 text-[14px] font-semibold">Within</legend>
        <div className="flex flex-wrap gap-2">
          {RADII_NM.map((nm) => (
            <button
              key={nm}
              type="button"
              aria-pressed={radius === nm}
              onClick={() => update('nm', String(nm))}
              className={`min-h-11 min-w-16 rounded-full border px-4 text-[14px] font-semibold ${
                radius === nm ? 'border-chart-blue bg-chart-blue text-white' : 'border-hairline bg-surface'
              }`}
            >
              {nm} nm
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-[14px] font-semibold">Training</span>
        <select
          value={training ?? ''}
          onChange={(e) => update('training', e.target.value === '' ? null : e.target.value)}
          className="min-h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3"
        >
          <option value="">Any training</option>
          {TRAINING.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <p className="text-[13px] text-ink-muted">Closest first. No school or CFI can pay for a higher place.</p>

      <section aria-labelledby="nearby-schools" className="flex flex-col gap-2">
        <h2 id="nearby-schools" className="font-semibold">
          Schools and clubs · <Ident>{result.clubs.length}</Ident>
        </h2>
        {result.clubs.length === 0 ? (
          <p className="text-ink-muted">None within {radius} nm. Try a wider radius.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {result.clubs.map(({ club, nm }) => (
              <ClubRow key={club.id} club={club} detail={`${club.homeAirport} · ${fmtNm(nm)}`} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="nearby-cfis" className="flex flex-col gap-2">
        <h2 id="nearby-cfis" className="font-semibold">
          CFIs · <Ident>{result.cfis.length}</Ident>
        </h2>
        {result.cfis.length === 0 ? (
          <p className="text-ink-muted">None within {radius} nm.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {result.cfis.map(({ account: c, icao, nm }) => (
              <PersonRow key={c.id} person={c} detail={`${c.cfi?.ratings.join(', ')} · ${icao} · ${fmtNm(nm)}`} />
            ))}
          </ul>
        )}
      </section>

      <ButtonLink to="/map">See them on the map</ButtonLink>
    </div>
  )
}
