import type { Account } from '../domain/types'

/** Initials on chart paper. No photos in the prototype. */
export function Avatar({ account, size = 40 }: { account: Pick<Account, 'displayName'>; size?: number }) {
  const initials = account.displayName
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full border border-hairline bg-chart-blue-tint font-semibold text-chart-blue"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  )
}
