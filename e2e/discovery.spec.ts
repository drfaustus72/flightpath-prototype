import { type Page, expect, test } from '@playwright/test'

/** Switches persona (the switcher returns to the feed), then opens `path`. */
async function viewAs(page: Page, persona: string, path: string) {
  await page.getByRole('button', { name: /viewing as/i }).click()
  await page.getByRole('dialog', { name: /view the demo as/i }).getByRole('button', { name: new RegExp(`^${persona}`) }).click()
  await expect(page.getByRole('button', { name: /viewing as/i })).toContainText(persona)
  await page.goto(path)
}

test.describe('M4a discovery and school pages', () => {
  test('a free pilot finds Hawthorne, browses nearby schools and CFIs, and joins a school', async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'Free pilot', '/explore')
    await page.getByLabel('Search pilots, CFIs and schools').fill('KHHR')
    await page.getByRole('link', { name: /KHHR airport page/ }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'KHHR' })).toBeVisible()
    const schools = page.locator('section', { has: page.getByRole('heading', { name: 'Schools and clubs at KHHR' }) })
    await expect(schools).toContainText('Hawthorne Flight Academy')
    await expect(page.locator('section', { has: page.getByRole('heading', { name: 'CFIs' }) })).toContainText('Dan Whitaker')
    const pilots = page.locator('section', { has: page.getByRole('heading', { name: 'Pilots based here' }) })
    await expect(pilots).toContainText('Lena Brooks')
    await expect(pilots).not.toContainText('Maya Ortiz') // Public, not Discoverable
    await expect(pilots).not.toContainText('Sam Patel') // minor
    await expect(page.getByRole('link', { name: /Airport in the Sky/ })).toHaveCount(0) // that mission lands at KAVX

    await page.getByRole('link', { name: 'Schools and CFIs near KHHR' }).click()
    await page.getByRole('button', { name: '10 nm' }).click()
    const nearbySchools = page.locator('section', { has: page.getByRole('heading', { name: /Schools and clubs ·/ }) })
    await expect(nearbySchools.getByRole('link').first()).toContainText('Hawthorne Flight Academy')
    await page.getByLabel('Training').selectOption('instrument')
    await expect(nearbySchools).not.toContainText('Coastal Aviation Training')
    await expect(nearbySchools).toContainText('Santa Monica Air School')

    await page.getByRole('link', { name: 'See them on the map' }).click()
    const list = page.getByRole('list', { name: 'Airports on the map' })
    await expect(list.getByRole('link', { name: /KHHR/ })).toContainText('3 pilots based here')

    await page.goto('/clubs/club-smo')
    await page.getByRole('button', { name: 'Request to join' }).click()
    await expect(page.getByText('Waiting for Santa Monica Air School to approve your request.')).toBeVisible()
  })

  test('a school admin approves a join request', async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'Free pilot', '/clubs/club-hfa')
    await page.getByRole('button', { name: 'Request to join' }).click()
    await viewAs(page, 'School admin', '/feed')
    // The admin's fourth tab is School (not Progress), with a count of what's waiting.
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link', { name: 'Progress' })).toHaveCount(0)
    await nav.getByRole('link', { name: /School.*2 waiting/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Hawthorne Flight Academy' })).toBeVisible()
    await page.getByRole('button', { name: 'Approve Jordan Reyes' }).click()
    await expect(page.getByText('No one is waiting.')).toBeVisible()
    // Admins confirm simulator sessions too.
    await page.getByRole('button', { name: 'Confirm session' }).click()
    await expect(nav.getByRole('link', { name: 'School' })).toBeVisible()
    await viewAs(page, 'Free pilot', '/clubs/club-hfa')
    await expect(page.getByText('You’re a member')).toBeVisible()
    // Now a School Pro member: missions open up without Pilot Pro.
    await page.goto('/missions/airport_in_the_sky')
    await expect(page.getByText('Part of Pilot Pro')).toHaveCount(0)
  })

  test('someone at the school claims an unclaimed page with an email at its domain', async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'Free pilot', '/clubs/club-desert')
    await expect(page.getByText(/Flightpath made this page from public directory data/)).toBeVisible()
    await page.getByRole('button', { name: 'Is this your school? Claim this page' }).click()
    await page.getByLabel(/Your email at desertwings.example/).fill('jordan@gmail.com')
    await page.getByRole('button', { name: 'Claim page' }).click()
    await expect(page.getByText(/Use an email address at desertwings.example/)).toBeVisible()
    await page.getByLabel(/Your email at desertwings.example/).fill('jordan@desertwings.example')
    await page.getByRole('button', { name: 'Claim page' }).click()
    await expect(page.getByText('Verified school')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open school tools' })).toBeVisible()
  })

  test('a CFI leaves the directory without losing sign-off authority', async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'CFI', '/profile')
    await page.getByRole('checkbox', { name: /List me in the CFI directory/ }).uncheck()
    await page.goto('/airports/KHHR')
    // Dan is viewing his own airport page; he never lists himself. Check as another pilot.
    await viewAs(page, 'Free pilot', '/airports/KHHR')
    await expect(page.getByText('No CFIs list this airport.')).toBeVisible()
    await viewAs(page, 'CFI', '/inbox')
    await expect(page.getByRole('button', { name: 'Sign off First solo' })).toBeVisible()
  })
})
