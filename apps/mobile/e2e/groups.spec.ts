import { button, createGroup, expect, fillExpense, seen, slide, test } from './fixtures'

test('a group: add an expense on the keypad, see the balance, settle up', async ({ user: { page } }) => {
  await createGroup(page, 'Goa Trip', ['Priya', 'Rohan'])
  await expect(seen(page, '3 people · INR')).toBeVisible()

  // Add expense opens on the amount, already in the group, split 3 ways.
  await button(page, 'Add expense to Goa Trip').click()
  await expect(button(page, 'Where it goes: Goa Trip')).toBeVisible()
  await fillExpense(page, '900', 'Dinner at Thalassa')
  await expect(seen(page, '₹300 each · 3 people · you lend ₹600')).toBeVisible()
  // The description picked the category.
  await expect(button(page, 'Category: Food')).toBeVisible()
  await button(page, 'Add expense').click()

  // Back on the group: the row and your balance.
  await expect(seen(page, 'Dinner at Thalassa')).toBeVisible()
  await expect(seen(page, 'You paid ₹900 · 3 people')).toBeVisible()
  await expect(seen(page, 'you lent')).toBeVisible()
  await expect(seen(page, 'you’re owed', true)).toBeVisible()
  await expect(seen(page, 'Priya and Rohan pay you in the plan')).toBeVisible()

  // The plan: two payments, one per person.
  await button(page, 'Settle up').click()
  await expect(page.getByRole('heading', { name: 'Balances' })).toBeVisible()
  await expect(seen(page, 'Priya pays you')).toBeVisible()
  await expect(seen(page, 'Rohan pays you')).toBeVisible()
  await button(page, 'Record').click()

  // The settle sheet starts on the full planned amount.
  await expect(seen(page, '₹300', true)).toBeVisible()
  await slide(page, button(page, 'Slide to record ₹300'))
  await expect(page.getByRole('heading', { name: 'Payment recorded' })).toBeVisible()
  await expect(seen(page, 'you’re owed ₹300')).toBeVisible()
  await button(page, 'Done').click()

  // One payment left in the plan, and it shows under recent payments.
  await expect(seen(page, 'One payment clears every balance')).toBeVisible()
  await expect(seen(page, /paid you ₹300/)).toBeVisible()
})

test('a group expense split by shares', async ({ user: { page } }) => {
  await createGroup(page, 'Flat 4B', ['Ira'])
  await button(page, 'Add expense to Flat 4B').click()
  await fillExpense(page, '300', 'Groceries for the flat')
  await button(page, 'Equally · 2').click()
  await page.getByRole('tab', { name: 'Shares' }).click()
  // You 2 shares, Ira 1: you owe ₹200 of it and lend Ira ₹100.
  await button(page, 'More for You').click()
  await expect(seen(page, '+₹100')).toBeVisible()
  await button(page, 'Done').click()
  await expect(button(page, 'Shares · 2')).toBeVisible()
  await button(page, 'Add expense').click()

  await expect(seen(page, 'Groceries for the flat')).toBeVisible()
  await seen(page, 'Groceries for the flat').click()
  await expect(seen(page, 'Split by shares · 2 people')).toBeVisible()
  await expect(seen(page, '₹200')).toBeVisible()
  await expect(seen(page, '₹100', true)).toBeVisible()
})
