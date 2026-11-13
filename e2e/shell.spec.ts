import { expect, test } from '@playwright/test'

test.describe('M0 app shell', () => {
  test('loads, navigates every tab, switches persona and resets the demo', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/feed$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Feed' })).toBeVisible()

    const nav = page.getByRole('navigation', { name: 'Main' })
    for (const [tab, heading] of [
      ['Explore', 'Explore'],
      ['Log flight', 'Log flight'],
      ['Progress', 'Progress'],
      ['Profile', 'Maya Ortiz'],
    ] as const) {
      await nav.getByRole('link', { name: tab }).click()
      await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible()
    }

    await page.getByRole('button', { name: /viewing as/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: /School admin/ }).click()
    await nav.getByRole('link', { name: 'Profile' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Alex Chen' })).toBeVisible()
    await page.getByRole('region', { name: 'Schools you manage' }).getByRole('link', { name: /Hawthorne Flight Academy/ }).click()
    await expect(page.getByText('School Pro tools')).toBeVisible()

    // Persona survives a reload (persisted state)
    await page.reload()
    await expect(page.getByRole('button', { name: /viewing as/i })).toContainText('School admin')

    // Reset returns to the first persona
    await page.getByRole('button', { name: /viewing as/i }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Reset demo' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Reset demo' }).click()
    await expect(page.getByRole('button', { name: /viewing as/i })).toContainText('Student pilot')
  })

  test('serves the web app manifest and icons', async ({ request }) => {
    const manifest = await request.get('/manifest.webmanifest')
    expect(manifest.ok()).toBe(true)
    const body = (await manifest.json()) as { icons: { src: string }[] }
    for (const icon of body.icons) expect((await request.get(icon.src)).ok()).toBe(true)
  })

  test('deep links work on reload (SPA fallback)', async ({ page }) => {
    await page.goto('/progress')
    await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible()
  })
})
