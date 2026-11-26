import { parseCsv } from '@settlr/shared/csv'
import { CURRENCIES, type Category, type Currency } from '@settlr/shared/schemas'

// Reads a Splitwise group export (Group → Export as spreadsheet): columns
// Date, Description, Category, Cost, Currency, then one per person holding
// what that row did to their balance (positive: they're owed). Each row
// becomes an expense with exact shares, or a payment when its category is
// "Payment".

export type SplitwiseImport = {
  members: Array<string>
  currency: Currency
  expenses: Array<{
    description: string
    date: string
    category: Category
    amountCents: number
    paidBy: number
    owed: Array<number>
  }>
  payments: Array<{ from: number; to: number; amountCents: number; date: string }>
  skipped: Array<string>
}

const CATEGORY_MAP: Array<[RegExp, Category]> = [
  [/dining|food|restaurant|liquor|drink/i, 'food'],
  [/grocer/i, 'groceries'],
  [/taxi|gas|fuel|parking|bus|train|plane|car|transport|bicycle/i, 'transport'],
  [/hotel|rent|mortgage|home|household|furniture|maintenance/i, 'lodging'],
  [/electric|heat|water|tv|phone|internet|utilit|trash|cleaning/i, 'utilities'],
  [/entertain|movie|music|game|sport/i, 'entertainment'],
]

function mapCategory(name: string): Category {
  return CATEGORY_MAP.find(([re]) => re.test(name))?.[1] ?? 'other'
}

const cents = (text: string) => Math.round(Number(text.replace(/,/g, '')) * 100)

export function parseSplitwise(text: string): SplitwiseImport {
  const rows = parseCsv(text)
  const header = rows[0]?.map((h) => h.trim())
  if (!header || header[0]?.toLowerCase() !== 'date' || header.length < 7) {
    throw new Error('That doesn’t look like a Splitwise export (the first column should be Date).')
  }
  const members = header.slice(5)
  const currencies = new Set<string>()
  const result: SplitwiseImport = { members, currency: 'USD', expenses: [], payments: [], skipped: [] }

  for (const row of rows.slice(1)) {
    const [date, description, category, cost, currency, ...nets] = row
    // The footer ("Total balance") has no date.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date?.trim() ?? '')) continue
    if (/^total balance$/i.test(description?.trim() ?? '')) continue
    const amount = cents(cost ?? '')
    const net = members.map((_, i) => cents(nets[i] ?? '0'))
    if (!Number.isFinite(amount) || amount <= 0 || net.some((n) => !Number.isFinite(n))) {
      result.skipped.push(`${date} ${description}: unreadable amounts`)
      continue
    }
    currencies.add((currency ?? '').trim().toUpperCase())
    if (/payment/i.test(category ?? '')) {
      const from = net.findIndex((n) => n > 0)
      const to = net.findIndex((n) => n < 0)
      if (from === -1 || to === -1) {
        result.skipped.push(`${date} ${description}: a payment without a payer and a payee`)
        continue
      }
      result.payments.push({ from, to, amountCents: amount, date: date.trim() })
      continue
    }
    // One payer: the person this row put furthest in credit. They paid the
    // whole cost; everyone else owes minus their balance change.
    const positives = net.filter((n) => n > 0).length
    if (positives > 1) {
      result.skipped.push(`${date} ${description}: paid by more than one person`)
      continue
    }
    let payer = net.indexOf(Math.max(...net))
    if (positives === 0) payer = 0
    const owed = net.map((n, i) => (i === payer ? amount - n : -n))
    if (owed.some((o) => o < 0) || owed.reduce((a, b) => a + b, 0) !== amount) {
      result.skipped.push(`${date} ${description}: shares don’t add up`)
      continue
    }
    result.expenses.push({
      description: (description ?? '').trim().slice(0, 80) || 'Expense',
      date: date.trim(),
      category: mapCategory(category ?? ''),
      amountCents: amount,
      paidBy: payer,
      owed,
    })
  }
  const known = [...currencies].filter((c) => (CURRENCIES as ReadonlyArray<string>).includes(c))
  if (currencies.size > 1) {
    throw new Error('This export mixes currencies; Settlr groups use one. Convert it in Splitwise first.')
  }
  result.currency = (known[0] as Currency | undefined) ?? 'USD'
  return result
}
