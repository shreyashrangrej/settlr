import { toCsv } from '@settlr/shared/csv'
import { formatMoney } from '@settlr/shared/format'
import type { Currency } from '@settlr/shared/schemas'
import type { FunctionReturnType } from 'convex/server'

import type { api } from '@settlr/backend/convex/_generated/api'

type ExportRows = FunctionReturnType<typeof api.exports.range>['rows']

/** Turns export rows into a CSV file and hands it to the browser to save. */
export function downloadCsv(rows: ExportRows, filename: string) {
  const plain = (cents: number | null) => (cents === null ? '' : (cents / 100).toFixed(2))
  const csv = toCsv([
    ['Date', 'Type', 'Description', 'Category', 'Where', 'Paid by', 'Amount', 'Currency', 'Your share', 'Tags'],
    ...rows.map((r) => [
      r.date,
      r.type,
      r.description,
      r.category,
      r.where,
      r.paidBy,
      plain(r.amountCents),
      r.currency,
      plain(r.shareCents),
      r.tags,
    ]),
  ])
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function totalLine(rows: ExportRows) {
  const totals = new Map<string, number>()
  for (const r of rows) {
    if (r.shareCents !== null) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.shareCents)
  }
  return [...totals].map(([c, cents]) => formatMoney(cents, c as Currency)).join(' + ')
}
