import { ButtonLink, EmptyState } from '../ui/primitives'

export function NotFoundScreen() {
  return (
    <EmptyState
      title="Page not found"
      body="That link doesn't match a page in Flightpath."
      action={<ButtonLink to="/feed">Go to feed</ButtonLink>}
    />
  )
}
