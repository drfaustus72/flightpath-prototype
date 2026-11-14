import { expect, test } from '@playwright/test'

test.describe('M1 log a flight', () => {
  test('Catalina sample: map, KAVX stamp, feed post and progress', async ({ page }) => {
    await page.goto('/log')
    await page.getByRole('button', { name: /Catalina lunch run/ }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Catalina lunch run' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Route of Catalina lunch run' }).first()).toBeVisible()
    await expect(page.getByText('KAVX', { exact: true })).toBeVisible()

    await page.getByLabel('Caption').fill('Lunch on the island')
    await page.getByRole('button', { name: 'Save flight' }).click()

    // Maya's seed flights already stamped KHHR, so only Catalina is new.
    await expect(page.getByText('New stamp', { exact: true })).toBeVisible()
    await expect(page.getByText('Lunch on the island')).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Full stop' })).toHaveCount(2)

    const nav = page.getByRole('navigation', { name: 'Main' })
    await nav.getByRole('link', { name: 'Feed' }).click()
    await expect(page.getByRole('article').filter({ hasText: 'Catalina lunch run' })).toBeVisible()

    await nav.getByRole('link', { name: 'Progress' }).click()
    await expect(page.getByRole('heading', { name: /Airports · 4/ })).toBeVisible()
    await expect(page.getByText('First flight logged')).toBeVisible()
    await expect(page.getByText('First 50 nm cross-country')).toHaveCount(0) // Catalina is ~31 nm

    // Logging the same airports again earns nothing new.
    await nav.getByRole('link', { name: 'Log flight' }).click()
    await page.getByRole('button', { name: /Catalina lunch run/ }).click()
    await expect(page.getByText('New stamp')).toHaveCount(0)
  })

  test('uploads a real ForeFlight KML of a simulator session', async ({ page }) => {
    await page.goto('/log')
    await page.locator('input[type=file]').setInputFiles('src/test/fixtures/foreflight-kemt-kpoc-sim.kml')
    await expect(page.getByRole('heading', { level: 1, name: 'KEMT → KPOC' })).toBeVisible()
    await expect(page.getByText('3 GPS glitches removed from the track.')).toBeVisible()
    await expect(page.getByText(/Simulator session \(X-Plane\)/)).toBeVisible()
    await expect(page.getByText('New stamp')).toHaveCount(0)
    await page.getByLabel('Tag a school or club').selectOption({ label: 'Hawthorne Flight Academy' })
    await page.getByRole('button', { name: 'Save flight' }).click()
    await expect(page.getByText('Simulator session', { exact: true })).toBeVisible()
    await expect(page.getByText(/Waiting for Hawthorne Flight Academy to confirm/)).toBeVisible()
    await expect(page.getByText(/new stamp/i)).toHaveCount(0)
  })

  test('explains an unreadable file', async ({ page }) => {
    await page.goto('/log')
    await page.locator('input[type=file]').setInputFiles({ name: 'notes.kml', mimeType: 'text/plain', buffer: Buffer.from('not a track') })
    await expect(page.getByRole('alert')).toContainText("isn't a readable GPX or KML file")
  })
})
