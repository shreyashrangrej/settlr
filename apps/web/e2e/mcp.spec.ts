import { createHash, randomBytes } from 'node:crypto'

import { expect, test } from './fixtures'

// An app connecting over MCP gets nothing until the user presses Allow: the
// code on the consent page can't be traded for a token before that (the
// `/mcp/token` check in convex/auth.ts, which leans on Better Auth internals).
test('an MCP app needs the user’s approval before it gets a token', async ({
  user: { page },
  request,
}) => {
  const redirectUri = 'http://localhost:3999/callback'
  const registered = await request.post('/api/auth/mcp/register', {
    data: {
      client_name: 'Test agent',
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
  })
  expect(registered.ok()).toBe(true)
  const { client_id: clientId } = await registered.json()

  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const authorize = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid',
    state: 'xyz',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  await page.goto(`/api/auth/mcp/authorize?${authorize}`)
  await expect(page.getByRole('heading', { name: 'Connect Test agent to Settlr?' })).toBeVisible()
  const consentCode = new URL(page.url()).searchParams.get('consent_code')
  expect(consentCode).toBeTruthy()

  const tokenFor = (code: string) =>
    request.post('/api/auth/mcp/token', {
      form: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier,
      },
    })
  const early = await tokenFor(consentCode!)
  expect(early.status()).toBe(401)
  expect(await early.json()).toMatchObject({ error: 'invalid_grant' })

  // Allow sends the browser back to the app with a code that works.
  await page.route(`${redirectUri}**`, (route) => route.fulfill({ body: 'ok' }))
  await page.getByRole('button', { name: 'Allow' }).click()
  await page.waitForURL(`${redirectUri}**`)
  const callback = new URL(page.url())
  expect(callback.searchParams.get('state')).toBe('xyz')
  const granted = await tokenFor(callback.searchParams.get('code')!)
  expect(granted.ok()).toBe(true)
  const { access_token: accessToken } = await granted.json()

  const tools = await request.post('/api/mcp', {
    headers: { authorization: `Bearer ${accessToken}` },
    data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
  })
  const names = (await tools.json()).result.tools.map((tool: { name: string }) => tool.name)
  expect(names).toContain('list_friends_and_groups')
})
