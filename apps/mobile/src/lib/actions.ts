import { ConvexError } from 'convex/values'
import { useState } from 'react'

import { toast } from '@/components/overlay'

/** What went wrong, in words: the server's message, or a network hint. */
export function errorText(error: unknown) {
  if (error instanceof ConvexError) {
    return typeof error.data === 'string' ? error.data : 'Something went wrong. Try again.'
  }
  if (error instanceof TypeError) return 'Can’t reach Settlr. Check your connection.'
  if (error instanceof Error) {
    // Convex wraps server errors as "[CONVEX M(...)] ... Uncaught ConvexError: <message>".
    const match = /ConvexError: (.+?)(\n|$)/.exec(error.message)
    if (match) return match[1]!
    return 'Something went wrong. Try again.'
  }
  return 'Something went wrong. Try again.'
}

/**
 * Runs a mutation with a pending flag; failures show a snackbar (and
 * resolve to undefined), successes the `success` message if given.
 */
export function useRun() {
  const [pending, setPending] = useState(false)
  async function run<T>(fn: () => Promise<T>, success?: string): Promise<T | undefined> {
    setPending(true)
    try {
      const result = await fn()
      if (success) toast(success)
      return result
    } catch (error) {
      toast(errorText(error), { tone: 'bad' })
      return undefined
    } finally {
      setPending(false)
    }
  }
  return { pending, run }
}
