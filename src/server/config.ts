import { createServerOnlyFn } from '@tanstack/react-start'

// Server configuration read from the environment. `createServerOnlyFn` makes
// the boundary explicit: the body is removed from the client bundle, and
// calling it in the browser throws instead of silently reading `undefined`.

export const getServerConfig = createServerOnlyFn(() => ({
  // Artificial delay for the balances query. Settling up is the "expensive"
  // part of a group page, so it is deferred and streamed; a small default
  // delay in development makes the streaming visible.
  balancesLatencyMs: Number(
    process.env.SETTLR_BALANCES_LATENCY_MS ??
      (process.env.NODE_ENV === 'production' ? 0 : 700),
  ),
}))
