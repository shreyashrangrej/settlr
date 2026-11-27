import { test as base, expect, type Locator, type Page } from '@playwright/test'

import { signInCode } from '../../web/e2e/admin'

export { expect }

let counter = 0

/** A unique address per call, so tests never share an account. */
export function uniqueEmail(name: string) {
  return `${name.toLowerCase()}-m${Date.now().toString(36)}${counter++}@example.com`
}

/** Signs in (or up) through Welcome → email → code, and waits for Home. */
export async function signIn(page: Page, email: string) {
  await page.goto('/')
  await button(page, 'Continue with email').click()
  await page.getByLabel('Email').fill(email)
  await button(page, 'Send code').click()
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible()
  let code: string | null = null
  await expect.poll(() => (code = signInCode(email)), { message: `a sign-in code for ${email}` }).not.toBeNull()
  // Six digits submit by themselves.
  await page.getByRole('textbox', { name: 'One-time code' }).fill(code!)
  await expect(button(page, 'Profile and settings')).toBeVisible()
}

type Fixtures = {
  /** `page`, signed in as a fresh account. */
  user: { page: Page; email: string }
}

export const test = base.extend<Fixtures>({
  user: async ({ page }, use) => {
    const email = uniqueEmail('alice')
    await signIn(page, email)
    await use({ page, email })
  },
})

/** Taps amount keys on Add expense's keypad: "12.5" → 1, 2, ., 5. */
export async function typeAmount(page: Page, amount: string) {
  for (const key of amount) {
    await page.getByRole('button', { name: key === '.' ? 'Decimal point' : key, exact: true }).click()
  }
}

/** Drags Slide to record all the way across. */
export async function slide(page: Page, track: Locator) {
  // Wait for the sheet to finish rising: a trial click waits until the
  // track stops moving, without pressing it.
  await track.click({ trial: true })
  const box = (await track.boundingBox())!
  const y = box.y + box.height / 2
  await page.mouse.move(box.x + 33, y)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 33 + ((box.width - 40) * i) / 12, y)
  await page.mouse.up()
}

/** Creates a group from the Groups tab and waits for its page. */
export async function createGroup(page: Page, name: string, members: Array<string>) {
  await page.getByRole('tab', { name: 'Groups' }).click()
  await button(page, 'New group').click()
  await page.getByLabel('Group name').fill(name)
  for (const member of members) {
    await page.getByLabel('Add a member').fill(member)
    await button(page, 'Add').click()
  }
  await button(page, 'Create group').click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}

/** On Add expense: the amount, what it was for, then Add. */
export async function fillExpense(page: Page, amount: string, description: string) {
  await typeAmount(page, amount)
  await page.getByLabel('Description').fill(description)
}

// The screens behind the one in front stay in the page on the web: pushed
// ones hidden, other tabs `inert`. These find things in front only.
const live = (page: Page) => page.locator(':not([inert], [inert] *)')

/** Text on the screen in front. */
export function seen(page: Page, text: string | RegExp, exact = false) {
  return page.getByText(text, { exact }).and(live(page)).filter({ visible: true }).first()
}

/** A button on the screen in front, by its exact name. */
export function button(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true }).and(live(page)).filter({ visible: true }).first()
}
