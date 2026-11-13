import { toPng } from 'html-to-image'
import { Download } from 'lucide-react'
import { useRef, useState } from 'react'
import { formatDuration } from '../../domain/flights'
import { missionsCompletedOn } from '../../domain/missions'
import { recognitionFor } from '../../domain/recognition'
import { can } from '../../domain/tiers'
import type { Flight } from '../../domain/types'
import { useActive, useWorld } from '../../store/hooks'
import { AirportMark } from '../../ui/AirportMark'
import { RouteSketch } from '../../ui/RouteSketch'
import { Button } from '../../ui/primitives'

/**
 * The achievement card a pilot saves and shares (brief section 9). Free pilots get the basic
 * stamp card; Pilot Pro gets the mission card with the route. Rendered at a fixed 4:5 size and
 * exported as a PNG in the browser: no social network APIs involved.
 */
export function ShareCard({ flight }: { flight: Flight }) {
  const world = useWorld()
  const { account, access } = useActive()
  const card = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'idle' | 'working' | 'saved' | 'error'>('idle')

  if (account.id !== flight.pilotId || !can(access, 'media.basicCard')) return null
  const polished = can(access, 'media.polishedCard')
  const mission = polished ? missionsCompletedOn(world, flight)[0] : undefined
  const stamp = recognitionFor(world, flight.pilotId).airports.find((a) => a.firstFlightId === flight.id)
  if (!mission && !stamp) return null

  const date = flight.startedAt ? new Date(flight.startedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
  const fileName = `flightpath-${(mission?.code ?? stamp?.icao ?? 'flight').toLowerCase()}.png`

  const save = async () => {
    if (!card.current) return
    setStatus('working')
    try {
      const dataUrl = await toPng(card.current, { pixelRatio: 3, cacheBust: true })
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], fileName, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: mission?.title ?? `${stamp?.icao} stamp` })
      } else {
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = fileName
        a.click()
      }
      setStatus('saved')
    } catch (error) {
      // A dismissed share sheet is not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus('idle')
        return
      }
      console.error('[flightpath] Could not create the achievement card image', { flightId: flight.id, error })
      setStatus('error')
    }
  }

  return (
    <section aria-labelledby="card-title" className="flex flex-col gap-3">
      <h2 id="card-title" className="font-semibold">
        Share card
      </h2>
      <div className="mx-auto w-full max-w-[320px]">
        <div
          ref={card}
          data-testid="achievement-card"
          className="flex aspect-[4/5] w-full flex-col justify-between overflow-hidden rounded-[var(--radius-panel)] border border-hairline bg-paper p-5 text-ink"
        >
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-extrabold tracking-tight">Flightpath</span>
            <span className="text-[12px] text-ink-muted">{date}</span>
          </div>
          {mission ? (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-semibold text-magenta">Mission complete</p>
              <p className="text-[24px] leading-tight font-bold tracking-tight">{mission.title}</p>
              <RouteSketch route={flight.route} height={96} label={`Route of ${flight.title}`} />
              <p className="font-ident text-[13px] text-ink-muted tabular-nums">
                {flight.stats.distanceNm.toFixed(0)} nm · {formatDuration(flight.stats.durationSec)}
                {stamp ? ` · new stamp ${stamp.icao}` : ''}
              </p>
            </div>
          ) : (
            stamp && (
              <div className="flex flex-col items-center gap-2 text-center">
                <AirportMark size={96} />
                <p className="font-ident text-[44px] leading-none font-bold">{stamp.icao}</p>
                <p className="text-[14px] text-ink-muted">{stamp.name}</p>
                <p className="text-[13px] font-semibold text-magenta">New airport stamp</p>
              </div>
            )
          )}
          <p className="text-[14px] font-semibold">{account.displayName}</p>
        </div>
      </div>
      <Button onClick={save} disabled={status === 'working'} className="self-center">
        <Download size={18} aria-hidden="true" />
        {status === 'working' ? 'Making image…' : 'Save or share image'}
      </Button>
      <p aria-live="polite" className="text-center text-[14px] text-ink-muted">
        {status === 'saved' && 'Image ready.'}
        {status === 'error' && 'Couldn’t make the image. Try again, or take a screenshot of the card.'}
        {!polished && status === 'idle' && 'Pilot Pro adds mission cards with your route.'}
      </p>
    </section>
  )
}
