// CSV in and out: exports from the expense pages, and the Splitwise import.

/** Quotes a cell when it needs it (RFC 4180). */
function cell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  // A leading =, +, - or @ would run as a formula in a spreadsheet.
  const safe = /^[=+\-@]/.test(text) && Number.isNaN(Number(text)) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}

/** Parses CSV text into rows of cells. Handles quotes, escaped quotes and CRLF. */
export function parseCsv(text: string): Array<Array<string>> {
  const rows: Array<Array<string>> = []
  let row: Array<string> = []
  let value = ''
  let quoted = false
  const input = text.replace(/^﻿/, '')
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        value += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        value += ch
      }
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(value)
      value = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++
      row.push(value)
      rows.push(row)
      row = []
      value = ''
    } else value += ch
  }
  if (value !== '' || row.length) {
    row.push(value)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}
