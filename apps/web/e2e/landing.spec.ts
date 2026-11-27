import { expect, test, uniqueEmail } from './fixtures'

// Every other test signs in through this page's form (`signIn` in
// fixtures.ts); these cover the page around it and the form's own steps.

test('the home page introduces Settlr and leads to the sign-in form', async ({ page }) => {
  await page.goto('/')
  const main = page.getByRole('main')

  await expect(main.getByRole('heading', { level: 1 })).toHaveText(/Split costs\.\s*Stay friends\./)
  await expect(main.getByRole('heading', { name: 'Welcome to Settlr' })).toBeVisible()
  // The product preview is described by its caption, not read row by row.
  await expect(main.getByRole('figure', { name: /A group in Settlr for a trip to Goa/ })).toBeAttached()
  await expect(main.getByRole('heading', { name: 'Everything a shared tab needs' })).toBeVisible()
  await expect(main.getByRole('heading', { level: 3 })).toHaveCount(7)

  // "Get started", at the bottom, goes back up to the form.
  const email = main.getByLabel('Email')
  await main.getByRole('link', { name: 'Get started' }).click()
  await expect(page).toHaveURL(/#sign-in$/)
  await expect(email).toBeInViewport()
})

test('the sign-in form checks the address, then asks for the code', async ({ page }) => {
  await page.goto('/')
  const main = page.getByRole('main')
  const email = main.getByLabel('Email')
  const send = main.getByRole('button', { name: 'Email me a code' })

  // A bad address is caught before anything is sent.
  await email.fill('not-an-email')
  await send.click()
  await expect(main.getByText('Enter a valid email address')).toBeVisible()
  await expect(email).toHaveAttribute('aria-invalid', 'true')
  await expect(main.getByRole('heading', { name: 'Check your inbox' })).toBeHidden()

  const address = uniqueEmail('lena')
  await email.fill(address)
  await send.click()
  await expect(main.getByRole('heading', { name: 'Check your inbox' })).toBeVisible()
  await expect(main.getByText(address)).toBeVisible()
  await expect(main.getByLabel('One-time code')).toBeFocused()
  await expect(main.getByRole('button', { name: 'Verify and sign in' })).toBeDisabled()
  // Resending waits out a cooldown.
  await expect(main.getByRole('button', { name: /^Resend in \d+s$/ })).toBeDisabled()

  // Going back keeps the address.
  await main.getByRole('button', { name: 'Different email' }).click()
  await expect(main.getByRole('heading', { name: 'Welcome to Settlr' })).toBeVisible()
  await expect(email).toHaveValue(address)
})

test('signed-in visitors go straight to their dashboard', async ({ user: { page } }) => {
  await page.goto('/')
  await page.waitForURL('**/dashboard')
  await expect(page.getByRole('heading', { name: 'Welcome to Settlr' })).toBeHidden()
})
