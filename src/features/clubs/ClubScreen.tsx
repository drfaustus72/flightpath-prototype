import { BadgeCheck, Globe } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router'
import { checkClaimEmail, claimDomain, currentMembership } from '../../domain/clubOps'
import { isStaffOfClub } from '../../domain/visibility'
import { clubPlanName, offersSchoolPlans } from '../../domain/clubs'
import { listedCfis } from '../../domain/directory'
import { feedFor } from '../../domain/social'
import { activeMemberCount, homeSchoolOf } from '../../domain/world'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Button, ButtonLink, EmptyState, Ident, Panel } from '../../ui/primitives'
import { FlightCard } from '../feed/FlightCard'
import { PersonRow } from '../social/PersonRow'

const TRAINING_NAMES: Record<string, string> = {
  private: 'Private',
  instrument: 'Instrument',
  commercial: 'Commercial',
  multi_engine: 'Multi-engine',
  cfi: 'CFI',
  tailwheel: 'Tailwheel',
}

export function ClubScreen() {
  const { clubId = '' } = useParams()
  const world = useWorld()
  const { account } = useActive()
  const club = world.clubs.find((c) => c.id === clubId)
  if (!club) return <EmptyState title="School not found" body="It may have been removed." action={<ButtonLink to="/explore">Go to Explore</ButtonLink>} />

  const airport = world.airports.find((a) => a.icao === club.homeAirport)
  const membership = currentMembership(world, account.id, club.id)
  const isMember = membership?.status === 'active'
  const hasFeed = club.plan === 'school_pro' || club.plan === 'community'
  const staff = listedCfis(world, account.id).filter((c) =>
    world.memberships.some((m) => m.accountId === c.id && m.clubId === club.id && m.status === 'active' && m.roles.includes('staff_cfi')),
  )
  const flights = hasFeed && isMember ? feedFor(world, account.id, 'clubs').filter((f) => f.clubId === club.id).slice(0, 5) : []

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-[var(--radius-panel)] bg-magenta-tint text-[18px] font-bold text-magenta">
          {club.initials}
        </span>
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-bold tracking-tight">{club.name}</h1>
          <p className="text-ink-muted">
            {clubPlanName(club)} ·{' '}
            <Link to={`/airports/${club.homeAirport}`} className="underline underline-offset-2">
              <Ident>{club.homeAirport}</Ident>
            </Link>
            {airport && ` ${airport.city}`}
          </p>
          {club.claimed && offersSchoolPlans(club) && (
            <p className="mt-1 inline-flex items-center gap-1 text-[14px] font-semibold text-chart-blue">
              <BadgeCheck size={16} aria-hidden="true" /> Verified school
            </p>
          )}
        </div>
      </div>

      {!club.claimed && <ClaimPanel clubId={club.id} />}

      {club.about && <p className="max-w-[60ch]">{club.about}</p>}
      {club.trainingOffered.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Training offered">
          {club.trainingOffered.map((t) => (
            <li key={t} className="rounded-full border border-hairline bg-surface px-3 py-1 text-[14px]">
              {TRAINING_NAMES[t]}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[14px] text-ink-muted">
        <Ident>{activeMemberCount(world, club.id)}</Ident> members
        {club.website && (
          <>
            {' · '}
            <a href={club.website} className="inline-flex items-center gap-1 underline underline-offset-2" rel="noreferrer" target="_blank">
              <Globe size={14} aria-hidden="true" /> {claimDomain(club)}
            </a>
          </>
        )}
      </p>

      <MembershipActions clubId={club.id} />

      {isStaffOfClub(world, account.id, club.id) && <ButtonLink to={`/school/${club.id}`}>Act as this school</ButtonLink>}

      {staff.length > 0 && (
        <section aria-labelledby="staff-title" className="flex flex-col gap-2">
          <h2 id="staff-title" className="font-semibold">
            Instructors
          </h2>
          <ul className="flex flex-col gap-2">
            {staff.map((c) => (
              <PersonRow key={c.id} person={c} detail={c.cfi?.ratings.join(', ') ?? 'CFI'} />
            ))}
          </ul>
        </section>
      )}

      {hasFeed ? (
        isMember ? (
          <section aria-labelledby="club-feed" className="flex flex-col gap-2">
            <h2 id="club-feed" className="font-semibold">
              Recent club flights
            </h2>
            {flights.length === 0 ? (
              <p className="text-ink-muted">No flights tagged to the club yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {flights.map((f) => (
                  <li key={f.id}>
                    <FlightCard flight={f} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <p className="text-[14px] text-ink-muted">Members see the club feed.</p>
        )
      ) : (
        <p className="text-[14px] text-ink-muted">School Basic pages show the member count only, not members’ activity.</p>
      )}
    </div>
  )
}

function MembershipActions({ clubId }: { clubId: string }) {
  const world = useWorld()
  const { account } = useActive()
  const club = world.clubs.find((c) => c.id === clubId)
  const requestJoin = useAppStore((s) => s.requestJoin)
  const cancel = useAppStore((s) => s.cancelJoinRequest)
  const leave = useAppStore((s) => s.leaveClub)
  const setHome = useAppStore((s) => s.setHomeSchool)
  const [confirmLeave, setConfirmLeave] = useState(false)
  if (!club) return null
  const m = currentMembership(world, account.id, clubId)
  const isHome = homeSchoolOf(world, account.id)?.id === clubId
  const onlyAdmin =
    m?.roles.includes('admin') === true &&
    !world.memberships.some((x) => x.clubId === clubId && x.status === 'active' && x.roles.includes('admin') && x.accountId !== account.id)

  if (!m) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button tone="primary" onClick={() => requestJoin(clubId)}>
          {club.claimed ? 'Request to join' : 'Add as my school'}
        </Button>
        {!club.claimed && <p className="text-[13px] text-ink-muted">Shown as self-reported until the school claims this page.</p>}
      </div>
    )
  }
  if (m.status === 'pending') {
    return (
      <Panel className="flex flex-col gap-2">
        <p>Waiting for {club.name} to approve your request.</p>
        <Button className="self-start" onClick={() => cancel(clubId)}>
          Cancel request
        </Button>
      </Panel>
    )
  }
  return (
    <Panel className="flex flex-col gap-2">
      <p className="font-semibold">
        You’re a member{isHome && offersSchoolPlans(club) ? ' · your home school' : ''}
        {!club.claimed && <span className="font-normal text-ink-muted"> (self-reported)</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {!isHome && offersSchoolPlans(club) && <Button onClick={() => setHome(clubId)}>Make my home school</Button>}
        {!onlyAdmin &&
          (confirmLeave ? (
            <>
              <Button tone="danger" onClick={() => leave(clubId)}>
                Leave {club.name}
              </Button>
              <Button onClick={() => setConfirmLeave(false)}>Stay</Button>
            </>
          ) : (
            <Button onClick={() => setConfirmLeave(true)}>Leave</Button>
          ))}
      </div>
      {confirmLeave && (
        <p className="text-[14px] text-ink-muted">
          Your flights and verified milestones stay on your profile. Any XP stays with {club.name} and doesn’t move to another school.
        </p>
      )}
    </Panel>
  )
}

function ClaimPanel({ clubId }: { clubId: string }) {
  const world = useWorld()
  const claim = useAppStore((s) => s.claimClub)
  const club = world.clubs.find((c) => c.id === clubId)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  if (!club) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const check = checkClaimEmail(club, email)
    if (!check.ok) {
      setError(check.error)
      return
    }
    claim(club.id, email)
  }

  return (
    <Panel className="flex flex-col gap-2 border-dashed">
      <p className="font-semibold">Unclaimed page</p>
      <p className="text-[14px] text-ink-muted">
        Flightpath made this page from public directory data. The school hasn’t confirmed it, so members’ affiliations are self-reported.
      </p>
      {!open ? (
        <Button className="self-start" onClick={() => setOpen(true)}>
          Is this your school? Claim this page
        </Button>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="claim-email" className="text-[14px]">
            Your email at {claimDomain(club) ?? 'the school'}
          </label>
          <input
            id="claim-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error !== null}
            aria-describedby={error ? 'claim-error' : 'claim-help'}
            className="min-h-11 rounded-[var(--radius-control)] border border-hairline bg-surface px-3"
          />
          {error ? (
            <p id="claim-error" className="text-[14px] text-danger">
              {error}
            </p>
          ) : (
            <p id="claim-help" className="text-[13px] text-ink-muted">
              In this demo, an address at the school’s website domain is enough. Claiming is free and makes you the page’s admin.
            </p>
          )}
          <Button type="submit" tone="primary" className="self-start">
            Claim page
          </Button>
        </form>
      )}
    </Panel>
  )
}
