import { expect, test } from './fixtures'

// Which commit a deploy runs: /api/health says, and Settings links to it.
test('the health check and Settings name the commit this build is from', async ({ page, request }) => {
  const response = await request.get('/api/health')
  expect(response.ok()).toBe(true)
  const health = await response.json()
  expect(health.status).toBe('ok')
  expect(health.commit).toMatch(/^[0-9a-f]{40}$/)

  await page.goto('/settings')
  const main = page.getByRole('main')
  await expect(main.getByText('Settlr build')).toBeVisible()
  await expect(main.getByRole('link', { name: health.commit.slice(0, 7), exact: true })).toHaveAttribute(
    'href',
    `https://github.com/shreyashrangrej/settlr/commit/${health.commit}`,
  )
})
