import { type Page, expect, test } from '@playwright/test'

/** Switches persona (the switcher returns to the feed), then opens `path`. */
async function viewAs(page: Page, persona: string, path: string) {
  await page.getByRole('button', { name: /viewing as/i }).click()
  await page.getByRole('dialog', { name: /view the demo as/i }).getByRole('button', { name: new RegExp(`^${persona}`) }).click()
  await expect(page.getByRole('button', { name: /viewing as/i })).toContainText(persona)
  await page.goto(path)
}

test.describe('M2 script B: CFI debrief and sign-off', () => {
  test('Dan verifies a milestone, debriefs and signs off a flight, then revokes', async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'CFI', '/feed')
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link', { name: 'Progress' })).toHaveCount(0)
    await nav.getByRole('link', { name: /Inbox/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Inbox' })).toBeVisible()

    // Milestone request from Maya
    await expect(page.getByText(/Maya Ortiz asks you to verify/)).toBeVisible()
    await page.getByLabel('Note for Maya (optional)').fill('Three solid full stops in the pattern.')
    await page.getByRole('button', { name: 'Sign off First solo' }).click()
    await expect(page.getByText(/asks you to verify/)).toHaveCount(0)

    // Flight to debrief and sign off
    await page.getByRole('link', { name: /Dual cross-country to Camarillo/ }).click()
    await page.getByLabel('Write a debrief').fill('Great pilotage. Start the descent 5 nm earlier next time.')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText('Great pilotage. Start the descent 5 nm earlier next time.')).toBeVisible()
    await page.getByRole('button', { name: 'Sign off flight' }).click()
    await expect(page.getByText(/CFI-verified · Dan Whitaker, Hawthorne Flight Academy/)).toBeVisible()
    await expect(page.getByText(/not an FAA endorsement/).first()).toBeVisible()

    // Maya sees the verification and the private debrief
    await viewAs(page, 'Student pilot', '/flights/flt-maya-dual-xc')
    await expect(page.getByText('Great pilotage. Start the descent 5 nm earlier next time.')).toBeVisible()
    await nav.getByRole('link', { name: 'Progress' }).click()
    const milestones = page.locator('section', { has: page.getByRole('heading', { name: 'Training milestones' }) })
    await expect(milestones.getByRole('listitem').filter({ hasText: 'First solo' })).toContainText('CFI-verified · Dan Whitaker')
    // Signed for the school and flown in its aircraft (the default), so it earns XP there.
    await expect(page.locator('section', { has: page.getByRole('heading', { name: 'XP at Hawthorne Flight Academy' }) })).toContainText('First solo')

    // A classmate can't read the debrief
    await viewAs(page, 'School admin', '/flights/flt-maya-dual-xc')
    await expect(page.getByRole('heading', { level: 1, name: 'Dual cross-country to Camarillo' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Debrief' })).toHaveCount(0)

    // Dan revokes the flight sign-off with a reason
    await viewAs(page, 'CFI', '/flights/flt-maya-dual-xc')
    await page.getByRole('button', { name: 'Revoke sign-off' }).click()
    await page.getByRole('button', { name: 'Revoke', exact: true }).click()
    await expect(page.getByText(/Say why you are revoking it/)).toBeVisible()
    await page.getByLabel('Reason for revoking').fill('Signed before reviewing the logbook')
    await page.getByRole('button', { name: 'Revoke', exact: true }).click()
    await expect(page.getByText(/CFI-verified/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sign off flight' })).toBeVisible()
  })

  test('Dan accepts an instructor tag and confirms a simulator session', async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'CFI', '/feed')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /Inbox/ }).click()
    await page.getByRole('button', { name: 'Accept tag on Pattern work at Hawthorne' }).click()
    await expect(page.getByRole('heading', { name: 'Tagged you as instructor' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Pattern work at Hawthorne\s*Sam Patel/ })).toBeVisible()
    // Simulator sessions are the school's work: Dan confirms it as a Hawthorne staff CFI.
    await expect(page.getByRole('heading', { name: 'Simulator sessions to confirm' })).toHaveCount(0)
    await page.getByRole('link', { name: /Hawthorne Flight Academy\s*\d+ waiting/ }).click()
    await expect(page.getByText('Acting as')).toBeVisible()
    // Staff CFIs work the queue; join requests stay with admins.
    await expect(page.getByRole('heading', { name: 'Join requests' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Confirm session' }).click()
    await expect(page.getByText('Nothing waiting.').last()).toBeVisible()
  })
})
