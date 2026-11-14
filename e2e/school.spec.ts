import { type Page, expect, test } from '@playwright/test'

/** Switches persona (the switcher returns to the feed), then opens `path`. */
async function viewAs(page: Page, persona: string, path: string) {
  await page.getByRole('button', { name: /viewing as/i }).click()
  await page.getByRole('dialog', { name: /view the demo as/i }).getByRole('button', { name: new RegExp(`^${persona}`) }).click()
  await expect(page.getByRole('button', { name: /viewing as/i })).toContainText(persona)
  await page.goto(path)
}

test.describe('M4b school space', () => {
  test('staff nudge a member with a mission; the pilot sees it on Progress and dismisses it', async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'CFI', '/school/club-hfa/members')
    // Staff CFIs can nudge but not sponsor seats.
    await page.getByRole('link', { name: /Maya/ }).click()
    await expect(page.getByText('Sponsored Pilot Pro seat')).toHaveCount(0)
    await page.getByLabel('Note').fill('Nice work on the dual cross-country. Ready to try Santa Paula?')
    await page.getByLabel('Suggest a mission').selectOption({ label: 'Santa Paula' })
    await page.getByRole('button', { name: 'Send nudge' }).click()
    await expect(page.getByRole('heading', { name: 'Nudge sent' })).toBeVisible()

    await viewAs(page, 'Student pilot', '/progress')
    const note = page.getByRole('region', { name: 'From your school' })
    await expect(note).toContainText('Ready to try Santa Paula?')
    await expect(note).toContainText('From Dan Whitaker')
    await expect(note.getByRole('link', { name: 'Try Santa Paula' })).toBeVisible()
    await note.getByRole('button', { name: /Dismiss/ }).click()
    await expect(page.getByRole('region', { name: 'From your school' })).toHaveCount(0)
  })

  test('an admin gives a member a sponsored Pilot Pro seat', async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'School admin', '/school/club-hfa/members?show=quiet')
    await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(6)
    await page.getByRole('link', { name: /Liam/ }).click()
    const seat = page.getByRole('checkbox', { name: /Sponsored Pilot Pro seat/ })
    await expect(seat).not.toBeChecked()
    await seat.check()
    await expect(seat).toBeChecked()
    await expect(page.getByText(/2 seats in use/)).toBeVisible()
  })

  test('the school asks to feature a mission; it goes on the wall only once the pilot says yes', async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'School admin', '/school/club-hfa/page')
    await page.getByRole('button', { name: 'Ask Maya Ortiz to feature Class C Arrival' }).click()
    await expect(page.getByText('Waiting for Maya Ortiz')).toBeVisible()
    await page.getByRole('link', { name: 'Preview the wall' }).click()
    await expect(page.getByText('Nothing on the wall yet.')).toBeVisible()

    await viewAs(page, 'Student pilot', '/progress')
    const ask = page.getByRole('region', { name: 'From your school' })
    await expect(ask).toContainText('would like to feature your Class C Arrival')
    await ask.getByRole('button', { name: 'Feature it' }).click()

    await page.goto('/clubs/club-hfa')
    await page.getByRole('link', { name: /Mission Wall/ }).click()
    const card = page.getByRole('article').filter({ hasText: 'Class C Arrival' })
    await expect(card).toContainText('Maya Ortiz')
    await expect(card).toContainText('Verified by Hawthorne Flight Academy')
    await card.getByRole('button', { name: 'Take Class C Arrival off the wall' }).click()
    await expect(page.getByText('Nothing on the wall yet.')).toBeVisible()
  })
})
