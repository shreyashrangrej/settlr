import { randomUUID } from 'node:crypto'
import { notFound } from '@tanstack/react-router'

import type { Expense, Group } from '#/lib/types'

// Server-only data store. The `.server.ts` suffix is enforced by TanStack
// Start's import protection: importing this file from anything that ends up
// in the client bundle fails the build.
//
// It is an in-memory store seeded with demo data, so it resets on restart and
// is not shared between server instances. Swap the functions below for a real
// database client; nothing outside `src/server` touches storage directly.

interface Store {
  groups: Map<string, Group>
  expenses: Map<string, Expense>
}

const globalForStore = globalThis as typeof globalThis & {
  __settlrStore?: Store
}

// Kept on globalThis so dev-server hot reloads don't wipe the data.
const store = (globalForStore.__settlrStore ??= seed())

export function newId() {
  return randomUUID().slice(0, 8)
}

export function listGroups(): Array<Group> {
  return [...store.groups.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
}

export function findGroup(groupId: string): Group | undefined {
  return store.groups.get(groupId)
}

/** Like `findGroup`, but throws a router `notFound()` for unknown ids. */
export function requireGroup(groupId: string): Group {
  const group = store.groups.get(groupId)
  if (!group) throw notFound()
  return group
}

export function insertGroup(group: Group) {
  store.groups.set(group.id, group)
}

export function listGroupExpenses(groupId: string): Array<Expense> {
  return [...store.expenses.values()].filter((e) => e.groupId === groupId)
}

export function insertExpense(expense: Expense) {
  store.expenses.set(expense.id, expense)
}

export function removeExpense(groupId: string, expenseId: string) {
  const expense = store.expenses.get(expenseId)
  if (!expense || expense.groupId !== groupId) return false
  return store.expenses.delete(expenseId)
}

function seed(): Store {
  const groups = new Map<string, Group>()
  const expenses = new Map<string, Expense>()

  const trip: Group = {
    id: 'lisbon-24',
    name: 'Lisbon trip',
    currency: 'EUR',
    createdAt: '2026-05-02T09:00:00.000Z',
    members: [
      { id: 'ana', name: 'Ana' },
      { id: 'ben', name: 'Ben' },
      { id: 'chloe', name: 'Chloe' },
      { id: 'dev', name: 'Dev' },
    ],
  }
  const flat: Group = {
    id: 'flat-3b',
    name: 'Flat 3B',
    currency: 'GBP',
    createdAt: '2026-08-01T09:00:00.000Z',
    members: [
      { id: 'maya', name: 'Maya' },
      { id: 'noah', name: 'Noah' },
      { id: 'omar', name: 'Omar' },
    ],
  }
  groups.set(trip.id, trip)
  groups.set(flat.id, flat)

  const everyone = (g: Group) => g.members.map((m) => m.id)
  const rows: Array<Omit<Expense, 'id' | 'createdAt'>> = [
    { groupId: trip.id, description: 'Apartment in Alfama', amountCents: 64_000, paidBy: 'ana', splitAmong: everyone(trip), category: 'lodging', date: '2026-05-10' },
    { groupId: trip.id, description: 'Airport taxi', amountCents: 3_850, paidBy: 'ben', splitAmong: everyone(trip), category: 'transport', date: '2026-05-10' },
    { groupId: trip.id, description: 'Pastéis de nata', amountCents: 1_240, paidBy: 'chloe', splitAmong: everyone(trip), category: 'food', date: '2026-05-11' },
    { groupId: trip.id, description: 'Tram 28 passes', amountCents: 2_400, paidBy: 'dev', splitAmong: everyone(trip), category: 'transport', date: '2026-05-11' },
    { groupId: trip.id, description: 'Seafood dinner', amountCents: 18_760, paidBy: 'ana', splitAmong: everyone(trip), category: 'food', date: '2026-05-11' },
    { groupId: trip.id, description: 'Fado show', amountCents: 9_000, paidBy: 'ben', splitAmong: ['ben', 'chloe', 'dev'], category: 'entertainment', date: '2026-05-12' },
    { groupId: trip.id, description: 'Groceries for breakfast', amountCents: 4_315, paidBy: 'chloe', splitAmong: everyone(trip), category: 'groceries', date: '2026-05-12' },
    { groupId: trip.id, description: 'Sintra day trip train', amountCents: 3_600, paidBy: 'dev', splitAmong: everyone(trip), category: 'transport', date: '2026-05-13' },
    { groupId: trip.id, description: 'Pena Palace tickets', amountCents: 8_000, paidBy: 'dev', splitAmong: everyone(trip), category: 'entertainment', date: '2026-05-13' },
    { groupId: trip.id, description: 'Farewell lunch', amountCents: 11_270, paidBy: 'ben', splitAmong: everyone(trip), category: 'food', date: '2026-05-14' },
    { groupId: flat.id, description: 'August rent', amountCents: 210_000, paidBy: 'maya', splitAmong: everyone(flat), category: 'lodging', date: '2026-08-01' },
    { groupId: flat.id, description: 'Electricity', amountCents: 9_412, paidBy: 'noah', splitAmong: everyone(flat), category: 'utilities', date: '2026-08-15' },
    { groupId: flat.id, description: 'Broadband', amountCents: 3_500, paidBy: 'omar', splitAmong: everyone(flat), category: 'utilities', date: '2026-08-18' },
    { groupId: flat.id, description: 'Big shop', amountCents: 7_864, paidBy: 'noah', splitAmong: everyone(flat), category: 'groceries', date: '2026-08-20' },
    { groupId: flat.id, description: 'September rent', amountCents: 210_000, paidBy: 'maya', splitAmong: everyone(flat), category: 'lodging', date: '2026-09-01' },
    { groupId: flat.id, description: 'Cleaning supplies', amountCents: 2_150, paidBy: 'omar', splitAmong: everyone(flat), category: 'groceries', date: '2026-09-04' },
  ]
  rows.forEach((row, i) => {
    const id = `seed-${i + 1}`
    expenses.set(id, {
      ...row,
      id,
      createdAt: `${row.date}T12:00:00.000Z`,
    })
  })

  return { groups, expenses }
}
