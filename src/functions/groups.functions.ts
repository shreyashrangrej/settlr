import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import {
  PAGE_SIZE,
  addExpenseInput,
  createGroupInput,
  deleteExpenseInput,
  groupIdInput,
  listExpensesInput,
} from '#/lib/schemas'
import type {
  Expense,
  ExpensePage,
  Group,
  GroupBalances,
  GroupInsights,
  GroupSummary,
} from '#/lib/types'
import { getServerConfig } from '#/server/config'
import {
  insertExpense,
  insertGroup,
  listGroupExpenses,
  listGroups,
  newId,
  removeExpense,
  requireGroup,
} from '#/server/db.server'
import { computeBalances, computeInsights } from '#/server/ledger.server'

// Server functions are the only way UI code reaches server-only modules.
// On the client, the Start compiler replaces each handler with a typed RPC
// call, so the `.server` imports above never reach the browser bundle.
// Every function validates its input with the shared zod schemas: the
// client's types are a convenience, not a trust boundary.

export const listGroupSummaries = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<GroupSummary>> =>
    listGroups().map((group) => {
      const expenses = listGroupExpenses(group.id)
      return {
        id: group.id,
        name: group.name,
        currency: group.currency,
        memberCount: group.members.length,
        expenseCount: expenses.length,
        totalCents: expenses.reduce((sum, e) => sum + e.amountCents, 0),
      }
    }),
)

export const getGroup = createServerFn({ method: 'GET' })
  .validator(groupIdInput)
  .handler(async ({ data }): Promise<Group> => requireGroup(data.groupId))

export const listExpenses = createServerFn({ method: 'GET' })
  .validator(listExpensesInput)
  .handler(async ({ data }): Promise<ExpensePage> => {
    requireGroup(data.groupId)
    const q = data.q.toLowerCase()
    const direction = data.order === 'asc' ? 1 : -1

    const matching = listGroupExpenses(data.groupId)
      .filter(
        (e) =>
          (data.category === 'all' || e.category === data.category) &&
          (!data.paidBy || e.paidBy === data.paidBy) &&
          (!q || e.description.toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        const primary =
          data.sort === 'amount'
            ? a.amountCents - b.amountCents
            : a.date.localeCompare(b.date)
        return (
          (primary || a.createdAt.localeCompare(b.createdAt)) * direction
        )
      })

    const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE))
    const page = Math.min(data.page, pageCount)
    return {
      items: matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      total: matching.length,
      page,
      pageCount,
    }
  })

export const getGroupBalances = createServerFn({ method: 'GET' })
  .validator(groupIdInput)
  .handler(async ({ data }): Promise<GroupBalances> => {
    const group = requireGroup(data.groupId)
    const { balancesLatencyMs } = getServerConfig()
    if (balancesLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, balancesLatencyMs))
    }
    return computeBalances(group, listGroupExpenses(group.id))
  })

export const getGroupInsights = createServerFn({ method: 'GET' })
  .validator(groupIdInput)
  .handler(async ({ data }): Promise<GroupInsights> => {
    const group = requireGroup(data.groupId)
    return computeInsights(group, listGroupExpenses(group.id))
  })

export const createGroup = createServerFn({ method: 'POST' })
  .validator(createGroupInput)
  .handler(async ({ data }) => {
    const group: Group = {
      id: newId(),
      name: data.name,
      currency: data.currency,
      members: data.members.map((name) => ({ id: newId(), name })),
      createdAt: new Date().toISOString(),
    }
    insertGroup(group)
    throw redirect({
      to: '/groups/$groupId',
      params: { groupId: group.id },
    })
  })

export const addExpense = createServerFn({ method: 'POST' })
  .validator(addExpenseInput)
  .handler(async ({ data }): Promise<Expense> => {
    const group = requireGroup(data.groupId)
    const memberIds = new Set(group.members.map((m) => m.id))
    if (!memberIds.has(data.paidBy)) {
      throw new Error('The payer is not a member of this group')
    }
    if (!data.splitAmong.every((id) => memberIds.has(id))) {
      throw new Error('Expenses can only be split between group members')
    }

    const expense: Expense = {
      ...data,
      splitAmong: [...new Set(data.splitAmong)],
      id: newId(),
      createdAt: new Date().toISOString(),
    }
    insertExpense(expense)
    return expense
  })

export const deleteExpense = createServerFn({ method: 'POST' })
  .validator(deleteExpenseInput)
  .handler(async ({ data }) => {
    requireGroup(data.groupId)
    if (!removeExpense(data.groupId, data.expenseId)) throw new Error('Expense not found')
    return { ok: true as const }
  })
