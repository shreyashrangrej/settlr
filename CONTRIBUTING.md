# Contributing

Thanks for helping improve Settlr! Bug reports, ideas and pull requests are
all welcome. By taking part you agree to the [code of conduct](CODE_OF_CONDUCT.md).

## Issues

- **Bugs**: [search first](https://github.com/shreyashrangrej/settlr/issues), then say what you did, what you expected and what happened (browser and a screenshot help).
- **Features**: describe the problem before the solution.
- **Security**: report privately through a [security advisory](https://github.com/shreyashrangrej/settlr/security/advisories/new), never in a public issue.

## Setup

```bash
pnpm install
pnpm dev:convex   # creates your Convex dev deployment
pnpm dev          # http://localhost:3000, in a second terminal
```

Add the deployment's URLs to `apps/web/.env.local`, then set `SITE_URL` and
`BETTER_AUTH_SECRET` on Convex. The [setup guide](https://settlr-docs.vercel.app/docs/development)
has the details; [CLAUDE.md](CLAUDE.md) has every convention and gotcha.

## Ground rules

- **Data goes through Convex.** Every function gets the user from `requireUser(ctx)` and scopes reads and writes to them.
- **Validate on both sides.** Use the same limits in `packages/shared/src/schemas.ts` and `packages/backend/convex/lib/input.ts`.
- **Money is integer cents** (`amountCents`), never floats.
- **Keep boundaries.** Server-only code lives in `apps/web/src/server/`; the backend never imports from `apps/web` (shared code goes in `packages/shared`).
- **Use the design system**: shadcn/ui (Base UI) and Tailwind utilities, not new CSS.
- **Commit generated code** in `packages/backend/convex/_generated/`.

## Pull requests

1. Branch from `main` and keep each PR to one fix or feature.
2. Run `pnpm typecheck && pnpm build` (there's no test suite yet), and try the change in dark mode and at phone width.
3. Update the matching page in [`apps/docs`](apps/docs/content/docs) when behaviour changes, and `CLAUDE.md` when a convention or the layout does.
4. Describe what changed and why, link the issue, and add screenshots for visual changes. Write commit messages in the imperative ("Add receipt viewer").
