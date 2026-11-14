import { type Page, expect, test } from '@playwright/test'

/** Switches persona (the switcher returns to the feed), then opens `path`. */
async function viewAs(page: Page, persona: string, path: string) {
  await page.getByRole('button', { name: /viewing as/i }).click()
  await page.getByRole('dialog', { name: /view the demo as/i }).getByRole('button', { name: new RegExp(`^${persona}`) }).click()
  await expect(page.getByRole('button', { name: /viewing as/i })).toContainText(persona)
  await page.goto(path)
}

test.describe('M4b script C: a school admin keeps pilots flying', () => {
  test('Alex reads the dashboard, nudges a quiet pilot with a mission, and features Maya’s card on the Mission Wall', async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'School admin', '/feed')
    await page.getByRole('link', { name: /^Act as Hawthorne Flight Academy/ }).click()

    // Dashboard: who is flying and who has gone quiet.
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('As of Nov 12.')).toBeVisible()
    const quietTile = page.locator('div', { has: page.getByText('Gone quiet', { exact: true }) }).filter({ hasText: 'no flight in 30+ days' }).last()
    await expect(quietTile).toContainText('6')
    await expect(page.getByRole('img', { name: /Week of .*: \d+ flights?/ }).first()).toBeVisible()
    const quiet = page.locator('section', { has: page.getByRole('heading', { name: 'Gone quiet' }) })
    await expect(quiet.getByRole('listitem')).toHaveCount(6)

    // Nudge Liam with a mission.
    await quiet.getByRole('link', { name: /Liam O’Connor/ }).click()
    await page.getByLabel('Suggest a mission').selectOption({ label: 'Santa Paula' })
    await page.getByRole('button', { name: 'Send nudge' }).click()
    await expect(page.getByRole('heading', { name: 'Nudge sent' })).toBeVisible()
    await expect(page.getByText('Suggested mission: Santa Paula')).toBeVisible()

    // Ask Maya to feature her Class C Arrival.
    await page.getByRole('navigation', { name: 'Hawthorne Flight Academy school' }).getByRole('link', { name: 'Page' }).click()
    await page.getByRole('button', { name: 'Ask Maya Ortiz to feature Class C Arrival' }).click()
    await expect(page.getByText('Waiting for Maya Ortiz')).toBeVisible()

    // Maya says yes; the card appears on the public wall.
    await viewAs(page, 'Student pilot', '/progress')
    await page.getByRole('region', { name: 'From your school' }).getByRole('button', { name: 'Feature it' }).click()
    await viewAs(page, 'School admin', '/school/club-hfa/page')
    await page.getByRole('link', { name: 'Preview the wall' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Mission Wall' })).toBeVisible()
    await expect(page.getByRole('article').filter({ hasText: 'Class C Arrival' })).toContainText('Verified by Hawthorne Flight Academy')
  })
})

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

  test('an admin makes a school challenge and a member joins it', async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'School admin', '/school/club-hfa/page')
    await page.getByLabel('Title').fill('Hawthorne Explorer')
    await page.getByLabel('Description').fill('Land at three airports you haven’t flown to before.')
    await page.getByLabel('Airports to land at').fill('3')
    await page.getByRole('button', { name: 'Create challenge' }).click()
    await expect(page.getByText('0 pilots joined')).toBeVisible()

    await viewAs(page, 'Student pilot', '/progress')
    const row = page.getByRole('listitem').filter({ hasText: 'Hawthorne Explorer' })
    await expect(row).toContainText('Hawthorne Flight Academy')
    await row.getByRole('button', { name: 'Join challenge' }).click()
    await expect(row).toContainText('0 of 3')
  })

  test('Dan suggests a mission from his roster and it leads Maya’s advisor', async ({ page }) => {
    await page.goto('/feed')
    await viewAs(page, 'CFI', '/inbox')
    await page.getByRole('link', { name: 'Open your roster' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Your students' })).toBeVisible()
    await page.getByRole('main').getByRole('link', { name: /Maya Ortiz/ }).click()
    await page.getByLabel('Mission').selectOption({ label: 'Santa Paula' })
    await page.getByLabel('Note (optional)').fill('Short runway practice before your long cross-country.')
    await page.getByRole('button', { name: 'Suggest mission' }).click()
    await expect(page.getByRole('heading', { name: 'You suggested' })).toBeVisible()

    await viewAs(page, 'Student pilot', '/progress')
    const advisor = page.locator('section', { hasText: 'Dan suggests' }).first()
    await expect(advisor).toContainText('Santa Paula')
    await expect(advisor).toContainText('Short runway practice')
    await expect(advisor).toContainText('Your CFI decides')
  })
})
