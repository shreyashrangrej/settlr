import type { Category, Currency } from '../../src/lib/schemas'
import type { Doc } from '../_generated/dataModel'
import { myFriendShare, shares } from './ledger'

// Personal, friend and group expenses in one shape, for the assistant: the
// model reads them as tool results and the chat shows them as cards.

export type ExpenseKind = 'personal' | 'friend' | 'group'

export type ExpenseView = {
  // How the model names this expense in tool calls: "<kind>:<id>".
  ref: string
  kind: ExpenseKind
  id: string
  description: string
  amountCents: number
  currency: Currency
  category: Category
  date: string
  // The friend's or group's name.
  with: string | null
  // Who paid and how it's split, e.g. "You paid, split equally".
  detail: string | null
  // What it cost the user: all of a personal expense, their share otherwise.
  myShareCents: number
  href: string
}

export type FriendExpense = Extract<Doc<'friendEntries'>, { kind: 'expense' }>

export function parseRef(ref: string): { kind: ExpenseKind; id: string } | null {
  const match = /^(personal|friend|group):(\w+)$/.exec(ref.trim())
  return match ? { kind: match[1] as ExpenseKind, id: match[2] } : null
}

export function personalView(e: Doc<'personalExpenses'>): ExpenseView {
  return {
    ref: `personal:${e._id}`,
    kind: 'personal',
    id: e._id,
    description: e.description,
    amountCents: e.amountCents,
    currency: e.currency,
    category: e.category,
    date: e.date,
    with: null,
    detail: null,
    myShareCents: e.amountCents,
    href: `/personal?month=${e.date.slice(0, 7)}`,
  }
}

export function friendView(e: FriendExpense, friend: Pick<Doc<'friends'>, 'name'>): ExpenseView {
  return {
    ref: `friend:${e._id}`,
    kind: 'friend',
    id: e._id,
    description: e.description,
    amountCents: e.amountCents,
    currency: e.currency,
    category: e.category,
    date: e.date,
    with: friend.name,
    detail: `${e.paidBy === 'me' ? 'You' : friend.name} paid, ${
      e.split === 'equal' ? 'split equally' : 'owed in full'
    }`,
    myShareCents: myFriendShare(e),
    href: `/friends/${e.friendId}`,
  }
}

export function groupView(
  e: Doc<'groupExpenses'>,
  group: Doc<'groups'>,
  meMemberId: string,
): ExpenseView {
  const name = (id: string) =>
    id === meMemberId ? 'you' : (group.members.find((m) => m.id === id)?.name ?? 'a former member')
  const payer = name(e.paidBy)
  const everyone = group.members.every((m) => e.splitAmong.includes(m.id))
  return {
    ref: `group:${e._id}`,
    kind: 'group',
    id: e._id,
    description: e.description,
    amountCents: e.amountCents,
    currency: group.currency,
    category: e.category,
    date: e.date,
    with: group.name,
    detail: `${payer.charAt(0).toUpperCase()}${payer.slice(1)} paid, split between ${
      everyone ? 'everyone' : e.splitAmong.map(name).join(', ')
    }`,
    myShareCents: shares(e, group.members.map((m) => m.id)).get(meMemberId) ?? 0,
    href: `/groups/${group._id}`,
  }
}
