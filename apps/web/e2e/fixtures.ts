import { test as base, expect, type Browser, type Page } from '@playwright/test'

import { signInCode } from './admin'

export { expect }

let counter = 0

/**
 * A unique address per call, so tests (and repeated runs against a reused
 * server) never share an account. The part before the @ becomes the
 * account's name until it's changed in Settings.
 */
export function uniqueEmail(name: string) {
  return `${name.toLowerCase()}-${Date.now().toString(36)}${counter++}@example.com`
}

/**
 * Signs in (or up) through the real login form with an email code. A new
 * account is asked its name first; it gets `name`.
 */
export async function signIn(page: Page, email: string, name = 'Alice Test') {
  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible()
  let code: string | null = null
  await expect
    .poll(() => (code = signInCode(email)), { message: `a sign-in code for ${email}` })
    .not.toBeNull()
  await page.getByLabel('One-time code').fill(code!)
  await page.waitForURL('**/dashboard')
  const nameStep = page.getByRole('heading', { name: 'What’s your name?' })
  // Either that step or the dashboard's greeting.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  if (await nameStep.isVisible()) {
    await page.getByLabel('Full name').fill(name)
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(nameStep).toBeHidden()
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name.split(' ')[0])
  }
}

/** A second person, in their own browser context. */
export async function otherUser(browser: Browser, name: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const email = uniqueEmail(name)
  await signIn(page, email, `${name} Test`)
  return { page, email, close: () => context.close() }
}

type Fixtures = {
  /** `page`, already signed in as a fresh account. */
  user: { page: Page; email: string }
}

export const test = base.extend<Fixtures>({
  user: async ({ page }, use) => {
    const email = uniqueEmail('alice')
    await signIn(page, email)
    await use({ page, email })
  },
})

/** Creates a group through the form and waits for its page. */
export async function createGroup(page: Page, name: string, members: Array<string>) {
  await page.goto('/groups/new')
  await page.getByLabel('Name').fill(name)
  for (const [i, member] of members.entries()) {
    if (i > 0) await page.getByRole('button', { name: 'Add member' }).click()
    await page.getByRole('textbox', { name: `Member ${i + 2}` }).fill(member)
  }
  await page.getByRole('button', { name: 'Create group' }).click()
  await page.waitForURL(/\/groups\/[^/]+$/)
  await expect(page.getByRole('main').getByRole('heading', { name })).toBeVisible()
}

/**
 * Adds an expense from an expense page's "Add expense" button, keeping the
 * dialog's defaults (you paid, split between everyone).
 */
export async function addExpense(page: Page, amount: string, description: string) {
  await page.getByRole('main').getByRole('button', { name: 'Add expense' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Amount').fill(amount)
  await dialog.getByLabel('Description').fill(description)
  await dialog.getByRole('button', { name: 'Add expense' }).click()
  await expect(dialog).toBeHidden()
}
