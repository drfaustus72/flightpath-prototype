import { type Page, expect, test } from '@playwright/test'

/** Switches persona (the switcher returns to the feed), then opens `path`. */
async function viewAs(page: Page, persona: string, path: string) {
  await page.getByRole('button', { name: /viewing as/i }).click()
  await page.getByRole('dialog', { name: /view the demo as/i }).getByRole('button', { name: new RegExp(`^${persona}`) }).click()
  await expect(page.getByRole('button', { name: /viewing as/i })).toContainText(persona)
  await page.goto(path)
}

test.describe('M2 social layer', () => {
  test('a free pilot finds Maya by @handle, follows her, gives Props and comments', async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'Free pilot', '/explore')
    const searchBox = page.getByLabel('Search pilots, CFIs and schools')

    // Maya is Public: no match by name, a match on her exact handle.
    await searchBox.fill('maya')
    await expect(page.getByText(/No pilots, CFIs or schools match/)).toBeVisible()
    await searchBox.fill('@maya_flies')
    await page.getByRole('link', { name: /Maya Ortiz/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Maya Ortiz' })).toBeVisible()
    await page.getByRole('button', { name: 'Follow' }).click()
    await expect(page.getByRole('button', { name: 'Unfollow' })).toBeVisible()

    const nav = page.getByRole('navigation', { name: 'Main' })
    await nav.getByRole('link', { name: 'Feed' }).click()
    const card = page.getByRole('article').filter({ hasText: 'Dual cross-country to Camarillo' })
    await expect(card).toContainText('With Dan Whitaker (instructor)')
    const props = card.getByRole('button', { name: /Props/ })
    await props.click()
    await expect(props).toHaveAttribute('aria-pressed', 'true')
    await expect(props).toContainText('1')

    await card.getByRole('link', { name: 'Dual cross-country to Camarillo' }).click()
    await page.getByLabel('Add a comment').fill('Pilotage all the way, nice!')
    await page.getByRole('button', { name: 'Post comment' }).click()
    await expect(page.getByText('Pilotage all the way, nice!')).toBeVisible()
    // Not the instructor: no debrief visible.
    await expect(page.getByRole('heading', { name: 'Debrief' })).toHaveCount(0)
  })

  test("minors stay private and never appear in search", async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'Free pilot', '/explore')
    await page.getByLabel('Search pilots, CFIs and schools').fill('sam_p')
    await expect(page.getByText(/No pilots, CFIs or schools match/)).toBeVisible()
    await page.goto('/u/sam_p')
    await expect(page.getByText(/This profile is private/)).toBeVisible()
    await expect(page.getByText('Home airport')).toHaveCount(0)
  })

  test('making a profile Private hides it from search', async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'Free pilot', '/profile')
    await page.getByRole('radio', { name: /Private/ }).check()
    await expect(page.getByRole('radio', { name: /Private/ })).toBeChecked()
    await viewAs(page, 'Student pilot', '/explore')
    await page.getByLabel('Search pilots, CFIs and schools').fill('jordan')
    await expect(page.getByText(/No pilots, CFIs or schools match/)).toBeVisible()
  })

  test('shows suggestions with reasons and shares a profile QR code', async ({ page }) => {
    await page.goto('/explore')
    await expect(page.getByRole('heading', { name: 'Pilots you may know' })).toBeVisible()
    await expect(page.getByText(/Also at Hawthorne Flight Academy|Based at KHHR/).first()).toBeVisible()
    await page.goto('/profile')
    await page.getByRole('button', { name: 'Show my QR code' }).click()
    await expect(page.getByRole('img', { name: /QR code for .*\/u\/maya_flies/ })).toBeVisible()
  })
})
