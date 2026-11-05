<div align="center">

<img src="apps/web/public/favicon.svg" width="64" height="64" alt="Settlr logo" />

# Settlr

**Split costs. Stay friends.**

Track shared expenses with friends, flatmates and trips, then settle up with the fewest payments.

[**Open the app**](https://settlr-woad.vercel.app) · [**Read the docs**](https://settlr-docs.vercel.app) · [Contributing](CONTRIBUTING.md)

![Next.js](https://img.shields.io/badge/Next.js_16-000?logo=nextdotjs&logoColor=fff)
![React](https://img.shields.io/badge/React_19-087ea4?logo=react&logoColor=fff)
![Convex](https://img.shields.io/badge/Convex-ee342f?logo=convex&logoColor=fff)
![Turborepo](https://img.shields.io/badge/Turborepo-ef4444?logo=turborepo&logoColor=fff)
![License: MIT](https://img.shields.io/badge/license-MIT-b18cff)

</div>

## Features

| | |
| --- | --- |
| 👥 **Groups** | Trips and flats with up to 20 people, split to the cent, with a settle-up plan that uses the fewest payments |
| 🤝 **Friends** | One-on-one ledgers per currency, shared with the other person once they accept a friend request |
| 💳 **Personal and budget** | Your own spending by month and category, and a monthly budget that counts your share of everything |
| 🧾 **Receipts** | Attach a photo or PDF to any expense |
| ✨ **Assistant** | "Taxi 600 in the Goa trip, paid by Priya": add, find and edit expenses in plain language |
| 🔌 **MCP server** | Use Settlr from Claude, ChatGPT and other MCP clients, signed in with OAuth |

## Quick start

Needs Node.js 22+, [pnpm](https://pnpm.io) and a free [Convex](https://convex.dev) account.

```bash
pnpm install
pnpm dev:convex   # create a Convex dev deployment and keep pushing the backend
pnpm dev          # http://localhost:3000
```

Then add the deployment's URLs to `apps/web/.env.local` and set `SITE_URL` and
`BETTER_AUTH_SECRET` on Convex. The [setup guide](https://settlr-docs.vercel.app/docs/development) walks through it.

## Repository

| Path | What's there |
| --- | --- |
| [`apps/web`](apps/web) | The app: Next.js 16 App Router, shadcn/ui on Base UI, Tailwind 4 |
| [`apps/docs`](apps/docs) | The docs site, built with Fumadocs |
| [`packages/backend`](packages/backend) | The Convex backend: data, functions and Better Auth |
| [`packages/shared`](packages/shared) | Zod schemas and formatting used by the app and the backend |
| [`design`](design) | Design tokens and screen mockups |

| Command | |
| --- | --- |
| `pnpm dev` / `pnpm dev:docs` | Run the app (`:3000`) or the docs (`:3001`) |
| `pnpm dev:convex` | Push the backend to your dev deployment on every change |
| `pnpm typecheck` / `pnpm build` | Check or build every workspace |

## Learn more

- [Using Settlr](https://settlr-docs.vercel.app/docs/guide/getting-started): friends, groups, budgets, the assistant and AI apps
- [Architecture](https://settlr-docs.vercel.app/docs/development/architecture), [data model](https://settlr-docs.vercel.app/docs/development/data-model) and [deployment](https://settlr-docs.vercel.app/docs/development/deployment)
- [Contributing](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE)
