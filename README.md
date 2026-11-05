# Settlr

Split shared expenses with friends, flatmates or trips, and settle up with the
fewest payments. Built with [Next.js](https://nextjs.org) (App Router,
React 19), [Convex](https://convex.dev) for data, [Better Auth](https://better-auth.com) for sign-in and
[shadcn/ui](https://ui.shadcn.com) on [Base UI](https://base-ui.com) for the
interface, in a [Turborepo](https://turborepo.com) monorepo with its
documentation site built on [Fumadocs](https://fumadocs.dev).

```bash
pnpm install
pnpm dev          # the web app, http://localhost:3000
pnpm dev:docs     # the docs, http://localhost:3001
pnpm dev:convex   # push packages/backend/convex to your dev deployment on every change
pnpm typecheck    # every workspace
pnpm build        # builds the web app and the docs
pnpm start        # runs the web app's production build
```

The full documentation, for people using Settlr and for people working on
it, is in [`apps/docs`](apps/docs/content/docs).

## What it does

After signing in (Google, or a one-time code by email) people land on an
overview of these areas:

- **Friends**: one-on-one expenses with a single person, outside any group.
  Each expense is split equally or owed in full by the other person, and
  "Settle up" records payments. Balances are kept per currency. Add a
  friend's email to send them a friend request; once they accept, you both
  see the same ledger (each from your own side) and get notified of new
  entries.
- **Groups**: trips, flats and dinners with up to 20 members (you are always
  one of them). Expenses are split equally between chosen members, balances
  are worked out to the cent, and a settle-up plan uses the fewest payments.
  Any member can record a payment (from the plan, or any other amount
  between two members), and delete it again. Groups can be renamed and
  members added, renamed or removed (removing is only allowed for people who
  aren't on any expense or payment, and the currency only changes while a
  group has no expenses).
- **Personal**: your own spending, month by month, with totals by category.
- **Budget**: an optional monthly budget per currency, on its own page
  because it counts everything you spend: personal expenses plus your share
  of friend and group expenses (progress, what's left, a daily allowance for
  the rest of the month, and where the money went).
- **Notifications**: friend requests to accept or decline, and a note
  whenever someone adds or edits an expense that involves you, records a
  payment with you, adds you to a group or accepts your request. The bell
  shows the count and opens a dropdown with the latest ones; "More" opens the
  full list.
- **Assistant**: a chat for expenses in plain language. It adds them ("Add
  tea personal expense 50", "Taxi 600 in the Goa trip, paid by Priya"),
  finds them with totals and your share ("How much did I spend on food this
  month?", "Show my expenses with Sam"), and edits them ("Change the tea to
  60"). It also creates groups and adds friends ("New group Pune stay with
  Vaishnavi, hotel 2000 split equally"). It can offer to delete one, but nothing is deleted until you press
  Delete in the chat. An LLM on [OpenRouter](https://openrouter.ai) calls
  tools that go through the same Convex mutations as the forms. It's off
  until `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` (any model with tool
  calling) are set on the Convex deployment.
- **MCP server**: the assistant's tools for Claude, ChatGPT and other agents
  that speak the [Model Context Protocol](https://modelcontextprotocol.io).
  Add `https://<your site>/api/mcp` as a custom connector (Settings shows
  the URL); the agent sends you to Settlr to sign in and approve it, then
  adds, finds, changes and deletes expenses, and creates groups and
  friends, as you, with its own model (no
  OpenRouter key needed). Connected apps are listed in Settings, where you
  can disconnect them.

Every expense can be edited after it's added (a linked friend's copy and
group balances follow), and can carry a **receipt**: an image (JPEG, PNG,
WebP, GIF) or PDF up to 10 MB, kept in Convex file storage. Clicking the
paperclip opens it in an in-app viewer. Dates are picked with shadcn's
calendar.

Friends and group members are people you track by name; they don't need an
account. A group's owner can link members to friends who have accepted a
friend request; linked members see the group, can add expenses and are
notified, but only the owner can edit or delete it.

## Project layout

```
apps/
  web/                         the Next.js app (package `web`)
    src/app/                   Next.js App Router
      layout.tsx               root document: session, providers, app shell
      page.tsx                 landing hero and sign-in
      (app)/                   signed-in area; its layout redirects signed-out
                               visitors. dashboard, friends, groups, personal,
                               budget, notifications, assistant,
                               receipts/[source]/[expenseId]
      settings/                browser preferences, MCP connector URL and apps
      connect/                 sign in and approve an MCP client (OAuth)
      api/auth/[...all]/       Better Auth proxy to Convex
      api/mcp/                 the MCP server (Streamable HTTP)
      .well-known/             OAuth metadata for MCP clients
      api/health/              liveness probe
    src/server/                server-only code (auth session, Convex prefetch)
    src/lib/                   isomorphic code: types, search params,
                               client-only preferences
    src/components/            app components; shadcn/ui (Base UI) in components/ui
  docs/                        documentation site (Fumadocs); pages in content/docs
packages/
  backend/convex/              @settlr/backend: schema, queries and mutations
    schema.ts                  tables and indexes
    friends.ts groups.ts personal.ts budgets.ts notifications.ts
    receipts.ts                receipt uploads (Convex file storage) and viewing
    assistant.ts               the chat assistant (tools in lib/assistantTools.ts)
    mcp.ts                     the same tools over MCP, and connected apps
    lib/                       auth helper, input checks, balance math, receipts
    auth.ts http.ts            Better Auth running inside Convex
  shared/src/                  @settlr/shared: zod schemas and formatting used
                               by both the web app and Convex
design/                        the design handoff (tokens and screen mockups)
```

Each page is a server component (`page.tsx`) that prefetches its data and
renders a client component (`view.tsx`) next to it; `loading.tsx` is the
page-shaped skeleton shown while it loads.

## How it's built

**Convex, through TanStack Query.** `apps/web/src/components/providers.tsx` connects
a `ConvexQueryClient` to TanStack Query. Server pages prefetch Convex queries
as the signed-in user with `prefetchQuery(api.x.y, args)`
(`apps/web/src/server/convex.server.ts`) and pass the results to `<Prefetched>`,
which seeds them into the browser's query cache. Client components read them
with `useSuspenseQuery(convexQuery(api.x.y, args))`, so the first HTML is
complete, and in the browser each query becomes a live WebSocket
subscription: pages update themselves after a mutation or a change in
another tab, with no refetching or `router.refresh()`. Mutations are called
with `useConvexMutation`.

**Precomputed totals.** Friend balances, group member totals, and group
category and month totals live on the friend or group document and are
updated in the same mutation as each expense or payment
(`packages/backend/convex/lib/ledger.ts`). Pages that show balances read one document instead
of summing a ledger.

**Validation on both sides.** Forms validate with the zod schemas in
`packages/shared/src/schemas.ts`. Convex functions check argument types with validators
and values with `packages/backend/convex/lib/input.ts` (same limits), and derive the user from
the auth token, never from arguments.

**Validated search params.** A group's expense filters, sort order and list
length live in the URL (`?category=food&sort=amount&limit=40`). Pages parse
them on the server with zod schemas (`apps/web/src/lib/search.ts`); invalid values
fall back to defaults instead of throwing, and links leave defaults out so
URLs stay clean. Lists grow with "Show more" rather than page numbers.

**Server-only boundaries.** Files in `apps/web/src/server/` import `server-only`, so
the build fails if one reaches a client bundle. The localStorage
preferences in `apps/web/src/lib/preferences.ts` throw if called on the server.

### Rendering per route

| Route                                  | Rendering            | Why                                                                                                                  |
| -------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/` (landing hero)                     | server               | Marketing page and sign-in form. Signed-in visitors are redirected to `/dashboard`.                                  |
| `/dashboard`, `/friends`, `/personal`, `/budget` | server     | Queries are prefetched on the server with the visitor's token, so the first HTML is complete.                        |
| `/groups/[groupId]` (+ expenses)       | server               | Shareable, filterable URLs render fully on the server. Adding and editing an expense are pages under it.            |
| `/receipts/[source]/[expenseId]`       | server               | The receipt's URL and its expense are prefetched; images show inline and PDFs in the browser's viewer.               |
| `/groups/[groupId]/insights`, `/notifications` | data on the server, UI in the browser | The UI uses the viewer's locale, time zone and clock, so it renders in `<ClientOnly>` (the server sends the skeleton). |
| `/assistant`                           | server               | Only whether the assistant is set up is prefetched; the conversation lives in the browser and isn't saved.          |
| `/settings`                            | browser              | Preferences live in localStorage.                                                                                    |
| `/connect`                             | server               | OAuth step for MCP clients: sign in, then approve the app. Opened directly, it redirects to `/settings`.             |
| `/api/health`                          | route handler        | JSON liveness probe for load balancers and platform health checks.                                                  |
| `/api/mcp`, `/.well-known/oauth-*`     | route handler        | The MCP server and the OAuth discovery documents MCP clients read before connecting.                                |

## Deployment

It's a standard Next.js app: deploy it to Vercel, or anywhere Node.js runs
with `pnpm build && pnpm start`.

Deploy the backend with `pnpm exec convex deploy` (in `packages/backend`), and set
`NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` for the web build.

The dev environment is on Vercel (Root Directory `apps/web`): every push to
`main` deploys the site, and its build (see `apps/web/vercel.json`) first
pushes `packages/backend/convex` to the dev Convex deployment with a deploy
key (`CONVEX_DEPLOY_KEY` in the Vercel project). Set the Convex deployment's
`SITE_URL` to the site's URL. The docs deploy as a second Vercel project
with Root Directory `apps/docs`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[code of conduct](CODE_OF_CONDUCT.md).
