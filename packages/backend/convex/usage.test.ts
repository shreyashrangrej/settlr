import { afterEach, describe, expect, test, vi } from 'vitest'

import { internal } from './_generated/api'
import { as, setup } from './test.setup'
import { AI_PER_DAY } from './usage'

afterEach(() => {
  vi.useRealTimers()
})

describe('usage caps', () => {
  test('each person can use the AI a limited number of times a day', async () => {
    const t = setup()
    const alice = as(t, 'Alice')
    for (let i = 0; i < AI_PER_DAY; i++) await alice.mutation(internal.usage.ai, {})
    await expect(alice.mutation(internal.usage.ai, {})).rejects.toThrow('times today')
    await as(t, 'Bob').mutation(internal.usage.ai, {})
  })

  test('sign-in codes to one address are capped per hour, then allowed again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const t = setup()
    const send = (email: string) => t.mutation(internal.usage.signInCode, { email })
    for (let i = 0; i < 5; i++) expect(await send('sam@example.com')).toBe(true)
    expect(await send('Sam@Example.com')).toBe(false)
    expect(await send('kim@example.com')).toBe(true)
    vi.setSystemTime(Date.now() + 60 * 60 * 1000)
    expect(await send('sam@example.com')).toBe(true)
  })
})
