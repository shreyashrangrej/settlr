import { button, expect, fillExpense, seen, test } from './fixtures'

test('first run, a budget, a personal expense, and delete with undo', async ({ user: { page } }) => {
  // A new account starts on "Get started".
  await expect(seen(page, "You're all square")).toBeVisible()
  await expect(button(page, 'Start a group')).toBeVisible()

  // A monthly budget from Spending.
  await page.getByRole('tab', { name: 'Spending' }).click()
  await button(page, 'Budget').click()
  await button(page, 'Set a budget').click()
  await page.getByLabel('Amount in INR').fill('10000')
  await button(page, 'Save').click()
  await expect(seen(page, '₹10,000')).toBeVisible()
  await button(page, 'Back to spending').click()

  // A personal expense from the + in the bottom bar.
  await button(page, 'Add expense').click()
  await expect(button(page, 'Where it goes: Personal')).toBeVisible()
  await fillExpense(page, '2500', 'Chai and samosa')
  await button(page, 'Add expense').click()

  await expect(seen(page, 'Chai and samosa')).toBeVisible()
  await expect(page.getByRole('img', { name: '25% of budget used' })).toBeVisible()
  await expect(seen(page, '₹7,500 left')).toBeVisible()

  // Delete it, then undo from the snackbar.
  await seen(page, 'Chai and samosa').click()
  await expect(page.getByRole('heading', { name: 'Chai and samosa' })).toBeVisible()
  await button(page, 'Delete').click()
  await page.getByRole('alert').getByRole('button', { name: 'Delete' }).click()
  await expect(seen(page, 'Deleted. It’s in Trash for 30 days.')).toBeVisible()
  await expect(seen(page, 'Chai and samosa')).toBeHidden()
  await button(page, 'Undo').click()
  await expect(seen(page, 'Chai and samosa')).toBeVisible()
})

test('naming a new account, Profile settings, and sign out', async ({ user: { page } }) => {
  // A new account is asked its name on Home.
  await expect(seen(page, 'What should we call you?')).toBeVisible()
  await page.getByLabel('Your name').fill('Aarav Mehta')
  await button(page, 'Save').click()
  await expect(seen(page, 'What should we call you?')).toBeHidden()
  await expect(page.getByRole('heading', { name: /, Aarav$/ })).toBeVisible()

  await button(page, 'Profile and settings').click()
  await expect(page.getByRole('heading', { name: 'Aarav Mehta' })).toBeVisible()
  await page.getByRole('tab', { name: 'Dark' }).click()
  await expect(page.getByRole('tab', { name: 'Dark' })).toHaveAttribute('aria-selected', 'true')

  await button(page, 'Edit name').click()
  await page.getByLabel('Full name').fill('Aarav M')
  await button(page, 'Save').click()
  await expect(page.getByRole('heading', { name: 'Aarav M', exact: true })).toBeVisible()

  await button(page, 'Sign out').click()
  await page.getByRole('alert').getByRole('button', { name: 'Sign out' }).click()
  await expect(button(page, 'Continue with email')).toBeVisible()
})
