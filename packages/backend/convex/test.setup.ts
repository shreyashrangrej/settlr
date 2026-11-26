/// <reference types="vite/client" />
import { convexTest } from 'convex-test'

import schema from './schema'

// Shared by the backend tests (`*.test.ts` here; the Convex CLI skips any
// file name with more than one dot, so none of this is deployed).

export const modules = import.meta.glob('./**/*.ts')

/** A fresh in-memory backend for one test. */
export function setup() {
  return convexTest(schema, modules)
}

export type Backend = ReturnType<typeof setup>

/**
 * Signs in as a test user. `requireUser` reads the identity's
 * `tokenIdentifier`, name and email, as Better Auth's JWT carries them.
 */
export function as(t: Backend, name: string) {
  const id = name.toLowerCase()
  return t.withIdentity({
    tokenIdentifier: `test|${id}`,
    subject: id,
    name,
    email: `${id}@example.com`,
  })
}

/** Today in YYYY-MM-DD, for date fields. */
export const today = () => new Date().toISOString().slice(0, 10)
