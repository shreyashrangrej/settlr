import { ConvexReactClient } from 'convex/react'

const url = process.env.EXPO_PUBLIC_CONVEX_URL
if (!url) {
  throw new Error(
    'EXPO_PUBLIC_CONVEX_URL is not set. Create apps/mobile/.env.local with the URLs from apps/web/.env.local (see the mobile app docs).',
  )
}

/** One client for the app's lifetime, talking to the same deployment as the web app. */
export const convex = new ConvexReactClient(url, {
  // There's no page to leave on a phone, so no "unsaved changes" prompt.
  unsavedChangesWarning: false,
})
