import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { seedResult } from '../data/seed'
import { STORAGE_KEY, STORAGE_VERSION, seedFingerprint } from '../store/appStore'
import { StoreProvider } from '../store/StoreProvider'
import { routes } from './routes'

// jsdom has no <dialog> modal support; emulate the open/close attribute.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute('open')
  this.dispatchEvent(new Event('close'))
}

function renderApp(path = '/') {
  if (!seedResult.ok) throw new Error('seed invalid')
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <StoreProvider world={seedResult.world}>
      <RouterProvider router={router} />
    </StoreProvider>,
  )
  return router
}

async function switchTo(label: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: /viewing as/i }))
  const dialog = screen.getByRole('dialog', { hidden: true })
  await user.click(within(dialog).getByRole('button', { name: new RegExp(label, 'i'), hidden: true }))
  return user
}

describe('app shell', () => {
  it('redirects / to the feed and shows all five tabs', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Feed' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const tab of ['Feed', 'Explore', 'Log flight', 'Progress', 'Profile']) {
      expect(within(nav).getByRole('link', { name: tab })).toBeInTheDocument()
    }
  })

  it('shows Pilot Pro progress for the sponsored student and a Pro gate for the free pilot', async () => {
    renderApp('/progress')
    expect(await screen.findByText(/XP and ranks are coming/)).toBeInTheDocument()
    const user = await switchTo('Free pilot')
    await user.click(screen.getByRole('link', { name: 'Progress' }))
    expect(await screen.findByText('Part of Pilot Pro')).toBeInTheDocument()
  })

  it('opens the School Pro console only for the school admin', async () => {
    renderApp('/school/club-hfa')
    expect(await screen.findByText("You don't manage this school")).toBeInTheDocument()
    const user = await switchTo('School admin')
    await user.click(screen.getByRole('link', { name: 'Profile' }))
    await user.click(await screen.findByRole('link', { name: /Hawthorne Flight Academy/ }))
    expect(await screen.findByText('School Pro tools')).toBeInTheDocument()
    expect(screen.getByText('Retention dashboard')).toBeInTheDocument()
  })

  it("shows a School Basic home school on the free pilot's profile", async () => {
    renderApp('/profile')
    const user = await switchTo('Free pilot')
    await user.click(screen.getByRole('link', { name: 'Profile' }))
    expect(await screen.findByText('Coastal Aviation Training')).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByText(/School Basic/)).toBeInTheDocument()
  })

  it('prompts an account with no home school to add one', async () => {
    if (!seedResult.ok) throw new Error('seed invalid')
    // Priya (independent CFI) is not a demo persona; restore her as the saved active account.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { world: seedResult.world, activeAccountId: 'acct-priya', seedFingerprint: seedFingerprint(seedResult.world) },
        version: STORAGE_VERSION,
      }),
    )
    renderApp('/profile')
    expect(await screen.findByText(/No home school/)).toBeInTheDocument()
    expect(screen.getByText('Verified CFI')).toBeInTheDocument()
  })

  it('shows a not-found page for unknown routes', async () => {
    renderApp('/nowhere')
    expect(await screen.findByText('Page not found')).toBeInTheDocument()
  })
})
