import type { Category, Currency } from './schemas'

// Plain serializable shapes shared by server functions and UI.

export interface Member {
  id: string
  name: string
}

export interface Group {
  id: string
  name: string
  currency: Currency
  members: Array<Member>
  createdAt: string
}

export interface Expense {
  id: string
  groupId: string
  description: string
  amountCents: number
  paidBy: string
  splitAmong: Array<string>
  category: Category
  date: string
  createdAt: string
}

export interface GroupSummary {
  id: string
  name: string
  currency: Currency
  memberCount: number
  expenseCount: number
  totalCents: number
}

export interface ExpensePage {
  items: Array<Expense>
  total: number
  page: number
  pageCount: number
}

export interface MemberBalance {
  memberId: string
  paidCents: number
  owedCents: number
  /** paid - owed. Positive: is owed money. Negative: owes money. */
  netCents: number
}

export interface Settlement {
  from: string
  to: string
  amountCents: number
}

export interface GroupBalances {
  balances: Array<MemberBalance>
  settlements: Array<Settlement>
}

export interface GroupInsights {
  totalCents: number
  byCategory: Array<{ category: Category; cents: number }>
  byMember: Array<{ memberId: string; paidCents: number; owedCents: number }>
  byMonth: Array<{ month: string; cents: number }>
  lastExpenseAt: string | null
}
