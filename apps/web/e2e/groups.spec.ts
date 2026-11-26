import { addExpense, createGroup, expect, otherUser, test } from './fixtures'

test('split an expense three ways and settle up', async ({ user: { page } }) => {
  await createGroup(page, 'Goa trip', ['Bob', 'Cara'])
  const main = page.getByRole('main')

  await addExpense(page, '90', 'Dinner')
  await expect(main.getByRole('cell', { name: 'Dinner Food' })).toBeVisible()
  await expect(main.getByRole('region', { name: 'Your balance' })).toContainText('+$60.00')
  // Bob and Cara owe $30 each (the Balances card).
  await expect(main.getByText('−$30.00', { exact: true })).toHaveCount(2)

  // Bob pays his share; the form comes filled in from the settle-up plan.
  await main.getByRole('button', { name: 'Record that Bob paid you' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Amount')).toHaveValue('30.00')
  await dialog.getByRole('button', { name: 'Record payment' }).click()
  await expect(dialog).toBeHidden()

  await expect(main.getByRole('region', { name: 'Your balance' })).toContainText('+$30.00')
  await expect(main.getByRole('button', { name: 'Record that Bob paid you' })).toBeHidden()
  await expect(main.getByRole('button', { name: 'Record that Cara paid you' })).toBeVisible()
})

test('a friend joins through the invite link and both see live balances', async ({
  user: { page },
  browser,
}) => {
  await createGroup(page, 'Flat 4B', ['Bob', 'Cara'])
  await addExpense(page, '90', 'Groceries')

  await page.getByRole('button', { name: 'More group actions' }).click()
  await page.getByRole('menuitem', { name: 'Invite and share links' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Turn on' }).first().click()
  const link = page.getByRole('textbox', { name: 'Join link' })
  await expect(link).toHaveValue(/\/join\/[0-9a-f]{32}$/)
  const inviteUrl = await link.inputValue()
  await page.keyboard.press('Escape')

  const bob = await otherUser(browser, 'Bob')
  await bob.page.goto(inviteUrl)
  await bob.page.getByRole('radio', { name: 'Bob' }).click()
  await bob.page.getByRole('button', { name: 'Join group' }).click()
  await bob.page.waitForURL(/\/groups\/[^/]+$/)
  const bobMain = bob.page.getByRole('main')
  // Bob joined as the existing member, so the expense already counts for him.
  await expect(bobMain.getByRole('region', { name: 'Your balance' })).toContainText('−$30.00')

  // Bob adds one; Alice's open page updates without a reload.
  await addExpense(bob.page, '30', 'Cleaning')
  await expect(bobMain.getByRole('region', { name: 'Your balance' })).toContainText('−$10.00')
  const main = page.getByRole('main')
  await expect(main.getByRole('cell', { name: /Cleaning/ }).first()).toBeVisible()
  await expect(main.getByRole('region', { name: 'Your balance' })).toContainText('+$50.00')
  await bob.close()
})
