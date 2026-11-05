import { CORS_HEADERS, authMetadata } from '#/server/mcp.server'

// Protected resource metadata (RFC 9728) for /api/mcp: which authorization
// server issues its tokens. Clients ask at the root and at
// /.well-known/oauth-protected-resource/api/mcp; both get the same document.
export function GET() {
  return authMetadata('oauth-protected-resource')
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
