import { type Page, expect, test } from '@playwright/test'

/** Switches persona (the switcher returns to the feed), then opens `path`. */
async function viewAs(page: Page, persona: string, path: string) {
  await page.getByRole('button', { name: /viewing as/i }).click()
  await page.getByRole('dialog', { name: /view the demo as/i }).getByRole('button', { name: new RegExp(`^${persona}`) }).click()
  await expect(page.getByRole('button', { name: /viewing as/i })).toContainText(persona)
  await page.goto(path)
}

test.describe('M3 script A: mission, card, Props and school-verified XP', () => {
  test('Maya follows the advisor to Catalina, shares the card, gets Props, and earns XP once Dan verifies', async ({ page }) => {
    await page.goto('/progress')
    const advisor = page.locator('section', { hasText: 'Next on Private Pilot Cross-Country' }).first()
    await expect(advisor).toContainText('Airport in the Sky')
    await expect(advisor).toContainText('Your CFI decides')
    await advisor.getByRole('link', { name: 'Open the mission briefing' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Airport in the Sky' })).toBeVisible()
    await expect(page.getByText(/not an FAA endorsement/)).toBeVisible()

    await page.goto('/log')
    await page.getByRole('button', { name: /Catalina lunch run/ }).click()
    await page.getByRole('button', { name: 'Save flight' }).click()
    await expect(page.getByText('New stamp', { exact: true })).toBeVisible()
    const missions = page.locator('section', { has: page.getByRole('heading', { name: 'Missions' }) })
    await expect(missions).toContainText('Mission complete')
    await expect(missions).toContainText('Waiting for your school to verify it')

    const card = page.getByTestId('achievement-card')
    await expect(card).toContainText('Airport in the Sky')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save or share image' }).click()
    expect((await download).suggestedFilename()).toBe('flightpath-airport_in_the_sky.png')
    const flightUrl = page.url()

    // Dan (follows Maya) gives Props, then verifies the mission as a Hawthorne staff CFI.
    await viewAs(page, 'CFI', '/feed')
    const post = page.getByRole('article').filter({ hasText: 'Catalina lunch run' })
    await post.getByRole('button', { name: /Props/ }).click()
    await expect(post.getByRole('button', { name: /Props/ })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('link', { name: /^Act as Hawthorne Flight Academy/ }).click()
    const row = page.getByRole('listitem').filter({ hasText: 'completed Airport in the Sky' })
    await row.getByRole('button', { name: 'Verify Airport in the Sky' }).click()
    await expect(page.getByText('completed Airport in the Sky')).toHaveCount(0)

    await viewAs(page, 'Student pilot', new URL(flightUrl).pathname)
    await expect(page.getByText(/Verified by Dan Whitaker, Hawthorne Flight Academy · \+200 XP there/)).toBeVisible()
    await page.goto('/progress')
    const xp = page.locator('section', { has: page.getByRole('heading', { name: 'XP at Hawthorne Flight Academy' }) })
    await expect(xp).toContainText('200')
    await expect(xp).toContainText('300 XP to Navigator')
    await expect(page.locator('section', { hasText: 'Next on Private Pilot Cross-Country' }).first()).toContainText('Class C Arrival')
  })

  test('a free pilot sees missions behind Pilot Pro and XP behind School Pro', async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'Free pilot', '/missions/airport_in_the_sky')
    await expect(page.getByText('Part of Pilot Pro')).toBeVisible()
    await page.goto('/progress')
    await expect(page.getByText('Part of School Pro')).toBeVisible()
    await expect(page.getByText(/Next on Private Pilot/)).toHaveCount(0)
  })

  test('Maya self-reports a mission and her school verifies it for XP', async ({ page }) => {
    await page.goto('/missions/santa_paula')
    await page.getByRole('button', { name: 'I flew this' }).click()
    await expect(page.getByText(/Self-reported\. Hawthorne Flight Academy can verify it for XP/)).toBeVisible()

    await viewAs(page, 'School admin', '/school/club-hfa')
    const row = page.getByRole('listitem').filter({ hasText: 'says they flew Santa Paula' })
    await expect(row).toContainText('Self-reported, with no track')
    await expect(row.getByRole('checkbox', { name: 'Flown in a Hawthorne Flight Academy aircraft' })).toBeChecked()
    await row.getByRole('button', { name: 'Verify Santa Paula' }).click()
    await expect(page.getByText('says they flew Santa Paula')).toHaveCount(0)

    await viewAs(page, 'Student pilot', '/progress')
    const xp = page.locator('section', { has: page.getByRole('heading', { name: 'XP at Hawthorne Flight Academy' }) })
    await expect(xp).toContainText('Santa Paula')
    await expect(xp).toContainText('+150')
  })

  test('records a no-go for the Good Call challenge', async ({ page }) => {
    await page.goto('/progress')
    const goodCall = page.getByRole('listitem').filter({ hasText: 'Record a flight you decided not to make' })
    await goodCall.getByRole('button', { name: 'Join challenge' }).click()
    await goodCall.getByLabel('Why you didn’t go').fill('Gusts 28 kt at Catalina')
    await goodCall.getByRole('button', { name: 'Record no-go' }).click()
    await expect(goodCall).toContainText('Recorded. Good call.')
    await expect(goodCall).toContainText('Done')
    await expect(page.getByText('Good Call', { exact: true }).last()).toBeVisible()
  })
})
