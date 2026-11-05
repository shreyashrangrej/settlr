import { CORS_HEADERS, authMetadata } from '#/server/mcp.server'

// OAuth server metadata (RFC 8414) for MCP clients: where to register,
// authorize and get tokens. Served by Better Auth's MCP plugin.
export function GET() {
  return authMetadata('oauth-authorization-server')
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
