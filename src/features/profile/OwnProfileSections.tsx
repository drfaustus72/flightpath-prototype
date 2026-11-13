import { ChevronRight, QrCode as QrIcon } from 'lucide-react'
import { useId, useRef } from 'react'
import { Link } from 'react-router'
import { accountById, pendingFlewWithTags, pendingFollowRequests } from '../../domain/social'
import type { ProfileLevel } from '../../domain/types'
import { useActive, useWorld } from '../../store/hooks'
import { useAppStore } from '../../store/storeContext'
import { Button, Panel } from '../../ui/primitives'
import { QrCode } from '../../ui/QrCode'

const LEVELS: { value: ProfileLevel; title: string; body: string }[] = [
  { value: 'private', title: 'Private', body: 'Only followers you approve see your profile and flights.' },
  { value: 'public', title: 'Public', body: 'Anyone with your link, QR code or exact @handle can see your profile. You don’t show up in search.' },
  { value: 'discoverable', title: 'Discoverable', body: 'Pilots can also find you in search and in “Pilots you may know”.' },
]

export function ProfileLevelPicker() {
  const { account } = useActive()
  const setProfileLevel = useAppStore((s) => s.setProfileLevel)

  if (account.isMinor) {
    return (
      <Panel>
        <p className="font-semibold">Profile: Private</p>
        <p className="mt-1 text-[14px] text-ink-muted">
          Accounts for pilots under 18 stay private: only followers you approve see your profile, and you don’t show up in search.
        </p>
      </Panel>
    )
  }
  return (
    <fieldset className="rounded-[var(--radius-panel)] border border-hairline bg-surface p-4">
      <legend className="px-1 font-semibold">Who can see your profile</legend>
      <div className="mt-1 flex flex-col">
        {LEVELS.map((l) => (
          <label key={l.value} className="flex min-h-11 items-start gap-3 py-2">
            <input
              type="radio"
              name="profile-level"
              value={l.value}
              checked={account.profileLevel === l.value}
              onChange={() => setProfileLevel(l.value)}
              className="mt-1 size-5 accent-chart-blue"
            />
            <span>
              <span className="block font-semibold">{l.title}</span>
              <span className="block text-[14px] text-ink-muted">{l.body}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Follow requests (Private profiles) and "flew with" tags waiting for an answer. */
export function WaitingForYou() {
  const world = useWorld()
  const { account } = useActive()
  const answerFollowRequest = useAppStore((s) => s.answerFollowRequest)
  const answerTag = useAppStore((s) => s.answerTag)
  const requests = pendingFollowRequests(world, account.id)
  const tags = pendingFlewWithTags(world, account.id)
  if (requests.length === 0 && tags.length === 0) return null

  return (
    <section aria-labelledby="waiting-title" className="flex flex-col gap-2">
      <h2 id="waiting-title" className="font-semibold">
        Waiting for you
      </h2>
      <ul className="flex flex-col gap-2">
        {requests.map((r) => {
          const who = accountById(world, r.followerId)
          return (
            <li key={r.followerId}>
              <Panel className="flex flex-col gap-2">
                <p>
                  <span className="font-semibold">{who?.displayName ?? 'Someone'}</span> wants to follow you.
                </p>
                <div className="flex gap-2">
                  <Button tone="primary" onClick={() => answerFollowRequest(r.followerId, true)}>
                    Approve
                  </Button>
                  <Button onClick={() => answerFollowRequest(r.followerId, false)}>Decline</Button>
                </div>
              </Panel>
            </li>
          )
        })}
        {tags.map((f) => (
          <li key={f.id}>
            <Panel className="flex flex-col gap-2">
              <p>
                <span className="font-semibold">{accountById(world, f.pilotId)?.displayName}</span> says you flew together on{' '}
                <Link to={`/flights/${f.id}`} className="font-semibold underline underline-offset-2">
                  {f.title}
                </Link>
                .
              </p>
              <div className="flex gap-2">
                <Button tone="primary" onClick={() => answerTag(f.id, true)}>
                  Accept tag
                </Button>
                <Button onClick={() => answerTag(f.id, false)}>Decline</Button>
              </div>
            </Panel>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Ramp QR code: meet at the FBO, scan, follow. Works for Public and Discoverable profiles. */
export function ShareProfile() {
  const { account } = useActive()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const url = `${window.location.origin}/u/${account.handle}`
  return (
    <>
      <Button onClick={() => dialog.current?.showModal()}>
        <QrIcon size={18} aria-hidden="true" />
        Show my QR code
      </Button>
      <dialog ref={dialog} aria-labelledby={titleId} className="m-auto rounded-[var(--radius-panel)] border border-hairline bg-surface p-6 text-center text-ink backdrop:bg-ink/40">
        <h2 id={titleId} className="text-lg font-semibold">
          @{account.handle}
        </h2>
        <p className="mb-3 text-[14px] text-ink-muted">Scan to open my Flightpath profile</p>
        <div className="flex justify-center">
          <QrCode value={url} label={`QR code for ${url}`} />
        </div>
        {account.profileLevel === 'private' && (
          <p className="mt-3 max-w-[30ch] text-[14px] text-ink-muted">Your profile is Private, so people who scan it can ask to follow you.</p>
        )}
        <Button className="mt-4" onClick={() => dialog.current?.close()}>
          Close
        </Button>
      </dialog>
    </>
  )
}

export function LinkRow({ to, title, detail }: { to: string; title: string; detail?: string }) {
  return (
    <Link to={to} className="flex min-h-14 items-center justify-between rounded-[var(--radius-panel)] border border-hairline bg-surface px-4">
      <span>
        <span className="block font-semibold">{title}</span>
        {detail && <span className="block text-[14px] text-ink-muted">{detail}</span>}
      </span>
      <ChevronRight size={20} aria-hidden="true" />
    </Link>
  )
}
