import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

// Global request middleware. Mutating requests (the POST server functions)
// must come from this origin; GET navigations and data reads are unaffected.
const csrf = createCsrfMiddleware({
  filter: ({ request }) => request.method !== 'GET' && request.method !== 'HEAD',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrf],
}))
