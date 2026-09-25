# Settlr

Split shared expenses with friends, flatmates or trips, and settle up with the
fewest payments. Built with [TanStack Start](https://tanstack.com/start)
(React, file-based TanStack Router, Vite, Nitro).

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm typecheck
pnpm build        # outputs .output/ for the selected runtime
pnpm start        # runs the node-server build
```

Data lives in an in-memory store seeded with two demo groups, so it resets
when the server restarts. Replace `src/server/db.server.ts` with a real
database client to persist it. Nothing outside `src/server/` touches storage.

## Project layout

```
src/
  routes/                  file-based routes (routeTree.gen.ts is generated)
  functions/               typed server functions: the only client → server bridge
  server/                  server-only code (store, ledger math, env config)
  lib/                     isomorphic code: zod schemas, types, formatting,
                           client-only preferences
  components/              shared UI (pending / error / not-found states)
  start.ts                 global request middleware (CSRF)
  router.tsx               router instance and defaults
```

## How it's built

**File-based routing.** Every file in `src/routes` is a route, and nested
folders are nested layouts. `groups/$groupId.tsx` is the group layout (header,
tabs, balances sidebar). The expenses list, insights and add-expense pages
render inside it.

**Validated search params.** The expense list's filters, sort order and page
live in the URL (`?category=food&sort=amount&page=2`). They are validated by
the zod schema in `src/lib/schemas.ts`. Invalid values fall back to defaults
instead of throwing, and `stripSearchParams` removes defaults so URLs stay
clean. `loaderDeps` re-runs the loader only when those params change.

**Loaders and typed server functions.** Route loaders call server functions
(`src/functions/groups.functions.ts`) built with `createServerFn`. Every
function validates its input with the same zod schemas the forms use, so the
server never trusts client types. Types flow end to end from the handler's
return type to `Route.useLoaderData()`. Mutations call `router.invalidate()` to
refresh the active loaders. `createGroup` throws a `redirect`, which
`useServerFn` follows on the client.

**Server-only boundaries.** Two mechanisms are used:

- `*.server.ts` files (`db.server.ts`, `ledger.server.ts`) are blocked from the
  client bundle by Start's import protection. A violation fails `pnpm build`.
- `createServerOnlyFn` (`src/server/config.ts`) guards environment access and
  throws if it's called in the browser. The mirror image, `createClientOnlyFn`,
  guards the localStorage preferences in `src/lib/preferences.ts`.

POST server functions are protected by the CSRF request middleware in
`src/start.ts`. Cross-site requests get a 403.

**Full-document SSR and streaming.** The root route's `shellComponent` renders
the whole HTML document on the server, including per-route `<title>`s from
`head()`. The group layout awaits the group but returns the balances as an
unawaited promise, rendered with `<Await>`. Browsers get the page shell and a
balances skeleton immediately, and the settle-up plan streams into the same
response when it's ready. Crawlers get fully resolved HTML. In development the
balances query has an artificial 700 ms delay so the streaming is visible. Set
`SETTLR_BALANCES_LATENCY_MS` to override it (the default in production is 0).

### SSR mode per route

| Route                            | `ssr`         | Why                                                                                                                                            |
| -------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/groups/new`               | `true`        | Content and forms belong in the first HTML response.                                                                                           |
| `/groups/$groupId` (+ expenses)  | `true`        | Shareable, filterable URLs render fully on the server; balances stream in.                                                                    |
| `/groups/$groupId/expenses/new`  | `true`        | Plain form; its data comes from the parent route.                                                                                              |
| `/groups/$groupId/insights`      | `'data-only'` | The loader runs on the server (no extra round trip), but the UI uses the viewer's locale, time zone and clock, so it renders only in the browser to avoid hydration mismatches. |
| `/settings`                      | `false`       | Preferences live in localStorage, so the loader and UI can only run in the browser.                                                           |
| `/api/health`                    | server route  | JSON liveness probe for load balancers and platform health checks.                                                                           |

For `false` and `'data-only'` routes, the server renders the router's
`defaultPendingComponent` in place of the route component.

## Deployment

The server is packaged by [Nitro](https://nitro.build) (`nitro()` in
`vite.config.ts`). The target runtime is chosen at build time, and the
application code stays the same:

```bash
pnpm build                                  # node-server (default) → pnpm start
NITRO_PRESET=vercel pnpm build
NITRO_PRESET=netlify pnpm build
NITRO_PRESET=cloudflare-module pnpm build
NITRO_PRESET=bun pnpm build
```

Because the data store is in memory, a serverless or multi-instance deployment
needs a real database first.
