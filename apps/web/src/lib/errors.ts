import { ConvexError } from 'convex/values'

// A message fit to show people. Convex functions throw `ConvexError` with a
// plain-language string for anything the user can fix; other errors are
// bugs or outages, so they get a generic message.
export function errorMessage(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === 'string') {
    return error.data
  }
  return 'Something went wrong. Try again.'
}
