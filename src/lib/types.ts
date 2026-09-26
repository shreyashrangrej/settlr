import type { FunctionReturnType } from 'convex/server'

import type { api } from '#convex/_generated/api'

// Shapes shared between pages, taken from what the Convex queries return so
// they can't drift from the backend.

// The signed-in user. `name` is empty until an email-code sign-up gives one.
export interface AuthUser {
  name: string
  email: string
}

export type Friend = FunctionReturnType<typeof api.friends.list>[number]
export type FriendEntry = FunctionReturnType<
  typeof api.friends.entries
>['items'][number]
export type GroupSummary = FunctionReturnType<typeof api.groups.list>[number]
export type Group = NonNullable<FunctionReturnType<typeof api.groups.get>>
export type GroupExpense = FunctionReturnType<
  typeof api.groups.expenses
>['items'][number]
export type GroupExpenseDetail = NonNullable<
  FunctionReturnType<typeof api.groups.expense>
>
export type PersonalMonth = FunctionReturnType<typeof api.personal.month>
export type AssistantReply = FunctionReturnType<typeof api.assistant.send>
export type ChatEvent = AssistantReply['events'][number]
export type AssistantExpense = Extract<ChatEvent, { type: 'added' }>['expense']
