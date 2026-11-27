import { expect, test, uniqueEmail } from './fixtures'

// Every other test signs in through this page's form (`signIn` in
// fixtures.ts); these cover the page around it and the form's own steps.

test('the home page introduces Settlr and says where its source is', async ({ page }) => {
  await page.goto('/')
  const main = page.getByRole('main')
  const repo = 'https://github.com/shreyashrangrej/settlr'

  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Shared expenses, settled.')
  await expect(page).toHaveTitle('Settlr · Shared expenses, settled')
  await expect(main.getByRole('heading', { name: 'Welcome to Settlr' })).toBeVisible()
  // The product preview is described by its caption, not read row by row.
  await expect(main.getByRole('figure', { name: /A group in Settlr for a trip to Goa/ })).toBeAttached()
  await expect(main.getByRole('heading', { name: 'What Settlr does' })).toBeVisible()
  await expect(main.getByRole('heading', { level: 3 })).toHaveCount(7)

  // The logo reads "Settlr by EntApex".
  const bar = page.getByRole('banner')
  await expect(bar.getByRole('link', { name: 'Settlr, home' })).toHaveText('Settlr by EntApex')

  // It's open source: the hero, the open-source section, the top bar and the
  // footer all link to the repository.
  await expect(main.getByRole('link', { name: 'View the source' })).toHaveAttribute('href', repo)
  const source = main.getByRole('region', { name: 'Open source, all of it' })
  await expect(source.getByRole('link', { name: 'View on GitHub' })).toHaveAttribute('href', repo)
  await expect(source.getByText(`git clone ${repo}`)).toBeVisible()
  await expect(bar.getByRole('link', { name: 'Source code on GitHub' })).toHaveAttribute('href', repo)
  const footer = main.getByRole('navigation', { name: 'Footer' })
  await expect(footer.getByRole('link', { name: 'MIT licence' })).toHaveAttribute('href', `${repo}/blob/main/LICENSE`)
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
