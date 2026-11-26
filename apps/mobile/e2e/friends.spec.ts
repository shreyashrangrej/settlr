import { button, expect, fillExpense, seen, slide, test } from './fixtures'

test('a friend: add them, share an expense, settle everything', async ({ user: { page } }) => {
  await page.getByRole('tab', { name: 'Friends' }).click()
  await button(page, 'Add a friend').click()
  await page.getByLabel('Name', { exact: true }).fill('Sam Carter')
  await button(page, 'Add friend').click()
  await expect(page.getByRole('heading', { name: 'Sam Carter' })).toBeVisible()
  await expect(seen(page, 'Only you see this ledger')).toBeVisible()

  await button(page, 'Add expense').click()
  await expect(button(page, 'Where it goes: Sam Carter')).toBeVisible()
  await fillExpense(page, '1200', 'Coffee beans')
  await expect(seen(page, 'Sam owes you ₹600')).toBeVisible()
  await button(page, 'Add expense').click()

  await expect(seen(page, 'Coffee beans')).toBeVisible()
  await expect(seen(page, 'Sam owes you')).toBeVisible()

  // Home shows it: in the hero and under Settle next.
  await page.goBack()
  await page.getByRole('tab', { name: 'Home' }).click()
  await expect(seen(page, 'Overall, you’re owed')).toBeVisible()
  await expect(button(page, 'Record payment from Sam Carter')).toBeVisible()

  await button(page, 'Record payment from Sam Carter').click()
  await expect(seen(page, 'owes you ₹600')).toBeVisible()
  await slide(page, button(page, 'Slide to record ₹600'))
  await expect(page.getByRole('heading', { name: 'All square with Sam' })).toBeVisible()
  await button(page, 'Done').click()
  await expect(seen(page, 'Overall, you’re owed')).toBeHidden()
})

test('an expense the friend paid, owed in full', async ({ user: { page } }) => {
  await page.getByRole('tab', { name: 'Friends' }).click()
  await button(page, 'Add a friend').click()
  await page.getByLabel('Name', { exact: true }).fill('Rohan')
  await button(page, 'Add friend').click()
  await button(page, 'Add expense').click()
  await fillExpense(page, '450', 'Movie tickets')
  await button(page, 'Split equally').click()
  await button(page, 'Paid by Rohan').click()
  await page.getByRole('tab', { name: 'In full' }).click()
  await expect(seen(page, 'You owe Rohan ₹450')).toBeVisible()
  await button(page, 'Done').click()
  await button(page, 'Add expense').click()
  await expect(seen(page, 'You owe Rohan')).toBeVisible()
  await expect(seen(page, 'you borrowed')).toBeVisible()
})
