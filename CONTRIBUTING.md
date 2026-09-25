# Contributing to Settlr

Thanks for your interest in improving Settlr! Bug reports, ideas and pull
requests are all welcome. By taking part you agree to follow the
[code of conduct](CODE_OF_CONDUCT.md).

## Reporting bugs and suggesting features

- Search the [existing issues](https://github.com/shreyashrangrej/settlr/issues)
  first; someone may have reported it already.
- For a bug, say what you did, what you expected and what happened instead.
  Include the browser, and a screenshot if it's visual.
- For a feature, describe the problem you want solved before the solution.
- Found a security problem? Please don't open a public issue. Report it
  privately through GitHub's
  [security advisories](https://github.com/shreyashrangrej/settlr/security/advisories/new).

## Setting up

You need Node.js 22+, [pnpm](https://pnpm.io) (the only supported package
manager) and a free [Convex](https://convex.dev) account.

```bash
pnpm install
pnpm dev:convex   # creates your dev deployment and writes .env.local
pnpm dev          # http://localhost:3000, in a second terminal
```

Then set the Convex deployment's environment variables:

```bash
pnpm exec convex env set SITE_URL=http://localhost:3000
pnpm exec convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
```

Without a Resend API key, sign-in codes aren't emailed; read them with
`pnpm exec convex logs`. Google sign-in stays off until `GOOGLE_CLIENT_ID`
and `GOOGLE_CLIENT_SECRET` are set. [CLAUDE.md](CLAUDE.md) has more on the
environment and its gotchas.

## Making a change

1. Fork the repository and create a branch from `main`.
2. Keep the change focused: one fix or feature per pull request.
3. Follow the conventions in [CLAUDE.md](CLAUDE.md). The important ones:
   - All data goes through Convex. Every query and mutation gets the user
     from `requireUser(ctx)` and scopes reads and writes to them; check
     values with `convex/lib/input.ts` using the same limits as the zod
     schemas in `src/lib/schemas.ts`.
   - Money is integer minor units (`amountCents`), never floats.
   - Server-only code lives in `*.server.ts` files and is reached from the UI
     through server functions only.
   - Use the shadcn/ui components (built on Base UI) and Tailwind utilities
     rather than new hand-written CSS.
   - Commit `src/routeTree.gen.ts` and `convex/_generated/` when they change.
4. Check your work before pushing:

   ```bash
   pnpm typecheck
   pnpm build
   ```

   There is no test suite yet, so also try the change in the browser,
   including dark mode and a narrow (phone-width) window.

## Pull requests

- Describe what changed and why, and link the issue it closes.
- Add screenshots for visual changes.
- Update `README.md` when you change what the app does, and `CLAUDE.md`
  when you change a convention or the project layout.
- Write commit messages in the imperative mood ("Add receipt viewer", not
  "Added receipt viewer").

A maintainer will review your pull request as soon as they can. Thanks for
contributing!
