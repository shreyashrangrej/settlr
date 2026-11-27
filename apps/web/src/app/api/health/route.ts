import { COMMIT_SHA } from '#/lib/site'

// A liveness probe for load balancers and platform health checks. `commit`
// says which build is running (null when it isn't known).
export function GET() {
  return Response.json(
    { status: 'ok', commit: COMMIT_SHA || null },
    { headers: { 'cache-control': 'no-store' } },
  )
}
