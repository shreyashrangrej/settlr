<div align="center">

<img src="apps/web/public/favicon.svg" width="64" height="64" alt="Settlr logo" />

# Settlr

**Shared expenses, settled.**

Track shared expenses with friends, flatmates and trips, then settle up with the fewest payments.

[**Open the app**](https://settlr-woad.vercel.app) · [**Read the docs**](https://settlr-docs.vercel.app/docs) · [Contributing](CONTRIBUTING.md)

![Next.js](https://img.shields.io/badge/Next.js_16-000?logo=nextdotjs&logoColor=fff)
![React](https://img.shields.io/badge/React_19-087ea4?logo=react&logoColor=fff)
![Convex](https://img.shields.io/badge/Convex-ee342f?logo=convex&logoColor=fff)
![Turborepo](https://img.shields.io/badge/Turborepo-ef4444?logo=turborepo&logoColor=fff)
![License: MIT](https://img.shields.io/badge/license-MIT-555)

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
| 🔁 **Bills and settling up** | Recurring expenses, Pay with UPI, reminders, payment confirmations, and a trash with undo |
| 📦 **Bring your data** | Import a Splitwise group, export CSV, and forward receipts to your own inbox address |
| 📱 **Android app** | The same account on your phone: [download the APK](https://github.com/shreyashrangrej/settlr/releases/latest) |

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
| [`apps/mobile`](apps/mobile) | The Android app: Expo and Expo Router, released as an APK from GitHub Actions |
| [`apps/docs`](apps/docs) | The docs site, built with Fumadocs |
| [`packages/backend`](packages/backend) | The Convex backend: data, functions and Better Auth |
| [`packages/shared`](packages/shared) | Zod schemas and formatting used by the app and the backend |
| [`design`](design) | Design tokens and screen mockups |

| Command | |
| --- | --- |
| `pnpm dev` / `pnpm dev:docs` | Run the app (`:3000`) or the docs (`:3001`) |
| `pnpm dev:mobile` | Run the Android app in Expo Go |
| `pnpm dev:convex` | Push the backend to your dev deployment on every change |
| `pnpm test` / `pnpm test:e2e` | Backend and unit tests, or the browser tests against a throwaway backend |
| `pnpm typecheck` / `pnpm build` | Check or build every workspace |

## Learn more

- [Using Settlr](https://settlr-docs.vercel.app/docs/guide/getting-started): friends, groups, budgets, the assistant, AI apps and the [Android app](https://settlr-docs.vercel.app/docs/guide/android)
- [Architecture](https://settlr-docs.vercel.app/docs/development/architecture), [data model](https://settlr-docs.vercel.app/docs/development/data-model), [testing](https://settlr-docs.vercel.app/docs/development/testing), the [mobile app](https://settlr-docs.vercel.app/docs/development/mobile-app) and [deployment](https://settlr-docs.vercel.app/docs/development/deployment)
- [Contributing](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE)
