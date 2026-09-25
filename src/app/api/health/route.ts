// A liveness probe for load balancers and platform health checks.
export function GET() {
  return Response.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } })
}
