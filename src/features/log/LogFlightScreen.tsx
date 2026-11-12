import { FileUp, Info, Loader2 } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { offersSchoolPlans } from '../../domain/clubs'
import type { PostChoices } from '../../domain/flights'
import { type FlightDraft, importTrack } from '../../domain/track/importTrack'
import { MAX_FILE_BYTES } from '../../domain/track/parse'
import { synthesize, toGpx } from '../../domain/track/synth'
import { recognitionFor } from '../../domain/recognition'
import { homeSchoolOf } from '../../domain/world'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Button, Ident, Panel, ScreenTitle } from '../../ui/primitives'
import { FlightMap } from '../flight/FlightMap'
import { FlightStats } from '../flight/FlightStats'
import { SAMPLES, type Sample } from './samples'

type State = { step: 'choose'; error: string | null } | { step: 'loading' } | { step: 'review'; draft: FlightDraft }

export function LogFlightScreen() {
  const world = useWorld()
  const [state, setState] = useState<State>({ step: 'choose', error: null })

  const load = async (getText: () => Promise<{ text: string; fileName: string }>) => {
    setState({ step: 'loading' })
    try {
      const { text, fileName } = await getText()
      const result = importTrack(text, fileName, world.airports)
      setState(result.ok ? { step: 'review', draft: result.draft } : { step: 'choose', error: result.error })
    } catch (error) {
      console.error('[flightpath] Track import failed', error)
      setState({ step: 'choose', error: 'That file couldn’t be read. Try exporting it again.' })
    }
  }

  const loadFile = (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setState({ step: 'choose', error: 'This file is larger than 10 MB. Export a single flight and try again.' })
      return
    }
    void load(async () => ({ text: await file.text(), fileName: file.name }))
  }

  const loadSample = (sample: Sample) =>
    load(async () => {
      if (sample.kind === 'synthetic') {
        return { text: toGpx(synthesize(sample.legs, world.airports, sample.start), sample.name), fileName: `${sample.id}.gpx` }
      }
      const res = await fetch(sample.url)
      if (!res.ok) throw new Error(`Sample ${sample.url} returned ${res.status}`)
      return { text: await res.text(), fileName: sample.fileName }
    })

  if (state.step === 'review') return <Review draft={state.draft} onDiscard={() => setState({ step: 'choose', error: null })} />

  return (
    <div className="flex flex-col gap-5">
      <ScreenTitle>Log flight</ScreenTitle>
      <Panel className="flex flex-col items-start gap-3">
        <h2 className="text-lg font-semibold">Upload a track</h2>
        <p className="max-w-[60ch] text-ink-muted">
          Export your track log as GPX or KML from ForeFlight, Garmin Pilot or your GPS app, then choose the file here.
        </p>
        <UploadButton disabled={state.step === 'loading'} onFile={loadFile} />
        {state.step === 'loading' && (
          <p className="flex items-center gap-2 text-ink-muted" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Reading track…
          </p>
        )}
        {state.step === 'choose' && state.error && (
          <p role="alert" className="text-danger">
            {state.error}
          </p>
        )}
      </Panel>

      <section aria-labelledby="samples-title">
        <h2 id="samples-title" className="mb-2 font-semibold">
          Or try a sample flight
        </h2>
        <ul className="flex flex-col gap-2">
          {SAMPLES.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={state.step === 'loading'}
                onClick={() => void loadSample(s)}
                className="flex min-h-14 w-full flex-col rounded-[var(--radius-panel)] border border-hairline bg-surface px-4 py-3 text-left hover:border-ink-muted disabled:opacity-50"
              >
                <span className="font-semibold">{s.name}</span>
                <span className="text-[14px] text-ink-muted">{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function UploadButton({ disabled, onFile }: { disabled: boolean; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onFile(file)
  }
  return (
    <>
      <input ref={input} type="file" accept=".gpx,.kml,application/gpx+xml,application/vnd.google-earth.kml+xml" onChange={onChange} className="sr-only" id="track-file" />
      <Button tone="primary" disabled={disabled} onClick={() => input.current?.click()}>
        <FileUp size={18} aria-hidden="true" />
        Choose GPX or KML file
      </Button>
    </>
  )
}

function Review({ draft, onDiscard }: { draft: FlightDraft; onDiscard: () => void }) {
  const world = useWorld()
  const { account } = useActive()
  const logFlight = useAppStore((s) => s.logFlight)
  const navigate = useNavigate()

  const schools = world.memberships
    .filter((m) => m.accountId === account.id && m.status === 'active')
    .map((m) => world.clubs.find((c) => c.id === m.clubId))
    .filter((c) => c !== undefined && offersSchoolPlans(c))
  const home = homeSchoolOf(world, account.id)

  const [choices, setChoices] = useState<PostChoices>({
    caption: '',
    routeVisibility: 'full',
    clubId: draft.isSimulator ? null : (home?.id ?? null),
    postVisibility: account.isMinor ? 'private' : 'public',
  })
  const set = <K extends keyof PostChoices>(key: K, value: PostChoices[K]) => setChoices((c) => ({ ...c, [key]: value }))

  const visited = new Set(recognitionFor(world, account.id).airports.map((a) => a.icao))
  const save = () => {
    const { flight, newAirports, newBadges } = logFlight(draft, choices)
    navigate(`/flights/${flight.id}`, {
      state: { newAirports: newAirports.map((a) => a.icao), newBadges: newBadges.map((b) => b.code) },
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <ScreenTitle>{draft.title}</ScreenTitle>
        {draft.startedAt && (
          <p className="text-ink-muted">
            {new Date(draft.startedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
      </div>

      <FlightMap route={draft.route} label={`Route of ${draft.title}`} />
      <FlightStats stats={draft.stats} landings={draft.landings.length} />

      {draft.importNotes.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Import notes">
          {draft.importNotes.map((n) => (
            <li key={n} className="flex gap-2 text-[14px] text-ink-muted">
              <Info size={16} className="mt-0.5 shrink-0 text-chart-blue" aria-hidden="true" />
              {n}
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby="airports-title">
        <h2 id="airports-title" className="mb-2 font-semibold">
          Airports
        </h2>
        {draft.airportsVisited.length === 0 ? (
          <p className="text-ink-muted">No airports detected on this track.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {draft.airportsVisited.map((icao) => {
              const isNew = !draft.isSimulator && !visited.has(icao)
              return (
                <li key={icao} className="flex items-center gap-2 rounded-full border border-hairline bg-surface py-1 pr-3 pl-3">
                  <Ident>{icao}</Ident>
                  {isNew && <span className="rounded-full bg-magenta-tint px-2 text-[12px] font-semibold text-magenta">New stamp</span>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <Panel className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Post</h2>
        <label className="flex flex-col gap-1">
          <span className="text-[14px] font-semibold">Caption</span>
          <textarea
            value={choices.caption}
            onChange={(e) => set('caption', e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="How was the flight?"
            className="rounded-[var(--radius-control)] border border-hairline bg-surface p-3"
          />
        </label>

        <Choice
          legend="Who can see this flight"
          value={choices.postVisibility}
          onChange={(v) => set('postVisibility', v)}
          options={[
            { value: 'public', label: 'Everyone', disabled: account.isMinor },
            { value: 'followers', label: 'Followers', disabled: account.isMinor },
            { value: 'private', label: 'Only me' },
          ]}
        />
        <Choice
          legend="Route on the map"
          value={choices.routeVisibility}
          onChange={(v) => set('routeVisibility', v)}
          options={[
            { value: 'full', label: 'Show full route' },
            { value: 'hide_ends', label: 'Hide first and last mile' },
            { value: 'hidden', label: 'Don’t show route' },
          ]}
        />
        {schools.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-[14px] font-semibold">Tag a school or club</span>
            <select
              value={choices.clubId ?? ''}
              onChange={(e) => set('clubId', e.target.value === '' ? null : e.target.value)}
              className="min-h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3"
            >
              <option value="">No tag</option>
              {schools.map((c) => (
                <option key={c?.id} value={c?.id}>
                  {c?.name}
                </option>
              ))}
            </select>
            {draft.isSimulator && (
              <span className="text-[13px] text-ink-muted">Tag your school if this session was in its simulator. Once the school confirms it, it counts toward XP.</span>
            )}
          </label>
        )}
      </Panel>

      <div className="flex gap-3">
        <Button onClick={onDiscard}>Discard</Button>
        <Button tone="primary" onClick={save} className="flex-1">
          Save flight
        </Button>
      </div>
    </div>
  )
}

function Choice<T extends string>({
  legend,
  value,
  onChange,
  options,
}: {
  legend: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; disabled?: boolean }[]
}): ReactNode {
  const name = useId()
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-[14px] font-semibold">{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className={`flex min-h-11 items-center gap-3 ${o.disabled ? 'opacity-50' : ''}`}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={o.disabled}
            onChange={() => onChange(o.value)}
            className="size-5 accent-chart-blue"
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  )
}
