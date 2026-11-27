import { button, expect, seen, test } from './fixtures'

// Add expense rises over the page it was opened from, and Close slides it
// down before the route goes (SheetPage holds the Back until then).
test('Add expense closes back to where it was opened', async ({ user: { page } }) => {
  await page.getByRole('tab', { name: 'Friends' }).click()
  await expect(page).toHaveURL(/\/friends$/)

  await button(page, 'Add expense').click()
  await expect(seen(page, 'New expense', true)).toBeVisible()
  await button(page, 'Close').click()
  await expect(page).toHaveURL(/\/friends$/)
  await expect(seen(page, 'New expense', true)).toBeHidden()

  // It opens again after closing (nothing is left mid-animation).
  await button(page, 'Add expense').click()
  await expect(seen(page, 'New expense', true)).toBeVisible()
  await button(page, 'Close').click()
  await expect(page).toHaveURL(/\/friends$/)
})

// A sheet route leaves once its sheet has slid away, whichever way it closed.
test('Add a friend closes on a tap outside the sheet', async ({ user: { page } }) => {
  await page.getByRole('tab', { name: 'Friends' }).click()
  await button(page, 'Add a friend').click()
  await expect(page).toHaveURL(/\/friends\/new$/)
  await expect(page.getByLabel('Name', { exact: true })).toBeVisible()

  // The scrim above the sheet.
  await button(page, 'Close').click({ position: { x: 20, y: 40 } })
  await expect(page).toHaveURL(/\/friends$/)
  await expect(page.getByLabel('Name', { exact: true })).toBeHidden()
})
