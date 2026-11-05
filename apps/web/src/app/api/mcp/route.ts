import { fetchAction } from 'convex/nextjs'

import { CORS_HEADERS, convexTokenForMcp } from '#/server/mcp.server'
import { api } from '@settlr/backend/convex/_generated/api'

// The MCP server (Streamable HTTP, stateless, JSON responses): Claude,
// ChatGPT and other agents add this URL as a connector and use the
// assistant's tools as the signed-in user. Requests carry an OAuth token
// from Better Auth; without a valid one the 401 points the client at the
// metadata it needs to sign the user in. The tools themselves run in
// Convex (convex/mcp.ts) with the user's Convex JWT.

type JsonRpcId = string | number | null

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...init?.headers },
  })
}

function rpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: '2.0' as const, id, error: { code, message } }
}

function unauthorized(request: Request) {
  const metadata = new URL('/.well-known/oauth-protected-resource/api/mcp', request.url)
  return json(rpcError(null, -32001, 'Sign in to Settlr to use these tools.'), {
    status: 401,
    headers: { 'WWW-Authenticate': `Bearer resource_metadata="${metadata}"` },
  })
}

// One JSON-RPC message: a request gets a reply; notifications and responses
// (this server sends no requests of its own) get none.
async function reply(message: unknown, token: string) {
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    return rpcError(null, -32600, 'Invalid request')
  }
  const { id, method, params } = message as Record<string, unknown>
  if (typeof method !== 'string') {
    return id === undefined ? null : rpcError(null, -32600, 'Invalid request')
  }
  if (id === undefined) return null
  const rpcId: JsonRpcId = typeof id === 'string' || typeof id === 'number' ? id : null
  try {
    const answer = JSON.parse(
      await fetchAction(
        api.mcp.handle,
        { method, params: JSON.stringify(params ?? {}) },
        { token },
      ),
    ) as { result?: unknown; error?: { code: number; message: string } }
    return answer.error
      ? rpcError(rpcId, answer.error.code, answer.error.message)
      : { jsonrpc: '2.0' as const, id: rpcId, result: answer.result }
  } catch (error) {
    console.error('MCP request failed', error)
    return rpcError(rpcId, -32603, 'Settlr couldn’t handle that. Try again.')
  }
}

export async function POST(request: Request) {
  let token: string | null
  try {
    token = await convexTokenForMcp(request.headers.get('authorization'))
  } catch (error) {
    console.error(error)
    return json(rpcError(null, -32603, 'Settlr is unavailable. Try again shortly.'), {
      status: 503,
    })
  }
  if (!token) return unauthorized(request)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), { status: 400 })
  }

  // Older protocol versions allow batches.
  const messages = Array.isArray(body) ? body : [body]
  const replies = (await Promise.all(messages.map((m) => reply(m, token)))).filter(
    (r) => r !== null,
  )
  if (replies.length === 0) return new Response(null, { status: 202, headers: CORS_HEADERS })
  return json(Array.isArray(body) ? replies : replies[0])
}

// No server-to-client stream and no sessions.
function notAllowed() {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { ...CORS_HEADERS, Allow: 'POST' },
  })
}
export const GET = notAllowed
export const DELETE = notAllowed

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
