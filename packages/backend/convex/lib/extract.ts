import { ConvexError } from 'convex/values'

import { CATEGORIES, CURRENCIES, type Category, type Currency } from '@settlr/shared/schemas'
import { env } from '../_generated/server'

// Asks an OpenRouter model to read an expense out of a receipt photo or an
// email, as JSON. Used by receipt scanning and the email inbox.

export type Extracted = {
  description: string
  amountCents?: number
  currency?: Currency
  category?: Category
  date?: string
}

const PROMPT = `Read the expense in this receipt or message. Reply with only a JSON object, no prose:
{"merchant": string (shop or service name, short), "total": number (the final amount paid, in the currency's main unit), "currency": ISO 4217 code, "date": "YYYY-MM-DD" or null, "category": one of ${CATEGORIES.join(', ')}}
Use null for anything you can't read.`

type Content = string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>

export async function extractExpense(content: Content, { vision }: { vision: boolean }): Promise<Extracted> {
  const apiKey = env.OPENROUTER_API_KEY
  const model = (vision && env.OPENROUTER_VISION_MODEL) || env.OPENROUTER_MODEL
  if (!apiKey || !model) throw new ConvexError('Reading receipts isn’t set up on this server.')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)
  let response: Response
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'HTTP-Referer': env.SITE_URL,
        'X-Title': 'Settlr',
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content },
        ],
      }),
      signal: controller.signal,
    })
  } catch {
    throw new ConvexError('Couldn’t reach the reader. Try again in a moment.')
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) {
    console.error('OpenRouter extract failed', response.status, await response.text())
    throw new ConvexError('Couldn’t read that. Fill it in by hand.')
  }
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const text = body.choices?.[0]?.message?.content ?? ''
  const json = /\{[\s\S]*\}/.exec(text)?.[0]
  let parsed: Record<string, unknown> = {}
  try {
    parsed = json ? (JSON.parse(json) as Record<string, unknown>) : {}
  } catch {
    parsed = {}
  }
  const total = typeof parsed.total === 'number' ? parsed.total : Number(parsed.total)
  const currency = String(parsed.currency ?? '').toUpperCase()
  const category = String(parsed.category ?? '').toLowerCase()
  const date = typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : undefined
  return {
    description: String(parsed.merchant ?? '').trim().slice(0, 80) || 'Receipt',
    amountCents:
      Number.isFinite(total) && total > 0 && total < 1_000_000 ? Math.round(total * 100) : undefined,
    currency: (CURRENCIES as ReadonlyArray<string>).includes(currency) ? (currency as Currency) : undefined,
    category: (CATEGORIES as ReadonlyArray<string>).includes(category) ? (category as Category) : undefined,
    date,
  }
}
