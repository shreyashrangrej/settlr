import 'server-only'

// Server half of the MCP endpoint (src/app/api/mcp/route.ts) and the OAuth
// discovery documents MCP clients read before connecting. Better Auth, on
// the Convex deployment, is the authorization server (see `mcpBridge` in
// convex/auth.ts).

const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL!

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'WWW-Authenticate',
}

/**
 * The Convex JWT for an MCP client's `Authorization: Bearer` header, or null
 * when the token is missing, unknown or expired (the client then signs in
 * again). Throws when the auth backend can't be reached.
 */
export async function convexTokenForMcp(authorization: string | null): Promise<string | null> {
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return null
  const response = await fetch(`${convexSiteUrl}/api/auth/mcp/convex-token`, {
    headers: { authorization },
    cache: 'no-store',
  })
  if (response.status === 401) return null
  if (!response.ok) throw new Error(`MCP token exchange failed: ${response.status}`)
  const body: unknown = await response.json()
  const token = typeof body === 'object' && body !== null ? (body as { token?: unknown }).token : null
  return typeof token === 'string' ? token : null
}

/** A Better Auth discovery document (under /api/auth/.well-known), with CORS. */
export async function authMetadata(name: 'oauth-authorization-server' | 'oauth-protected-resource') {
  const response = await fetch(`${convexSiteUrl}/api/auth/.well-known/${name}`, {
    cache: 'no-store',
  })
  return new Response(response.body, {
    status: response.status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
