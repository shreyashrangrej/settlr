import { z } from 'zod'

// Shared schemas: the same definitions validate URL search params in the
// router, form input on the client, and server function input on the server.

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'] as const
export type Currency = (typeof CURRENCIES)[number]

export const CATEGORIES = [
  'food',
  'groceries',
  'transport',
  'lodging',
  'utilities',
  'entertainment',
  'other',
] as const
export type Category = (typeof CATEGORIES)[number]

export const EXPENSE_SORTS = ['date', 'amount'] as const
export const SORT_ORDERS = ['desc', 'asc'] as const
// "Show more" lists grow by this many rows at a time.
export const LIST_STEP = 20
export const MAX_LIST_LIMIT = 500

const id = z.string().trim().min(1).max(64)
const isoDate = z.iso.date('Pick a date')
// Integer minor units (cents); never floats for money.
const amountCents = z
  .number()
  .int()
  .positive('Amount must be greater than zero')
  .max(100_000_000, 'That amount is too large')
const description = z.string().trim().min(1, 'Describe the expense').max(80)
const limit = z
  .number()
  .int()
  .min(1)
  .max(MAX_LIST_LIMIT)
  .default(LIST_STEP)
  .catch(LIST_STEP)

// --- Search params --------------------------------------------------------

export const expenseSearchDefaults = {
  q: '',
  category: 'all',
  paidBy: '',
  sort: 'date',
  order: 'desc',
  limit: LIST_STEP,
} as const

// Every field has a default and a catch, so a hand-edited or stale URL never
// throws: invalid values quietly fall back to the default.
export const expenseSearchSchema = z.object({
  q: z.string().trim().max(100).default('').catch(''),
  category: z
    .enum(['all', ...CATEGORIES])
    .default('all')
    .catch('all'),
  paidBy: z.string().max(64).default('').catch(''),
  sort: z.enum(EXPENSE_SORTS).default('date').catch('date'),
  order: z.enum(SORT_ORDERS).default('desc').catch('desc'),
  limit,
})
export type ExpenseSearch = z.infer<typeof expenseSearchSchema>

export const listSearchDefaults = { limit: LIST_STEP } as const
export const listSearchSchema = z.object({ limit })

// An empty month means "the current month".
export const monthSearchDefaults = { month: '' } as const
export const monthSearchSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .or(z.literal(''))
    .default('')
    .catch(''),
})

// --- Receipts -------------------------------------------------------------
// The same limits as convex/lib/receipts.ts, which re-checks every upload.

export const RECEIPT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024

// --- Form input -----------------------------------------------------------
// The Convex functions re-check the same limits (convex/lib/input.ts).

export const createGroupInput = z.object({
  name: z.string().trim().min(1, 'Give the group a name').max(60),
  currency: z.enum(CURRENCIES),
  // Everyone except you; you're always the first member.
  members: z
    .array(z.string().trim().min(1).max(40))
    .min(1, 'Add at least one other member')
    .max(19, 'A group can have up to 20 members')
    .refine(
      (names) =>
        new Set(names.map((n) => n.toLowerCase())).size === names.length,
      'Member names must be unique',
    ),
})
export type CreateGroupInput = z.infer<typeof createGroupInput>

// The whole member list after editing: members with an `id` are kept (and
// may be renamed), those without are new, and anyone missing is removed.
export const editGroupInput = z.object({
  name: z.string().trim().min(1, 'Give the group a name').max(60),
  currency: z.enum(CURRENCIES),
  members: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1, 'Every member needs a name').max(40),
        // One of your connected friends, or null for "not on Settlr".
        friendId: z.string().nullable(),
      }),
    )
    .min(2, 'A group needs at least two members')
    .max(20, 'A group can have up to 20 members')
    .refine(
      (members) =>
        new Set(members.map((m) => m.name.toLowerCase())).size === members.length,
      'Member names must be unique',
    ),
})

export const addExpenseInput = z.object({
  description,
  amountCents,
  paidBy: id,
  splitAmong: z.array(id).min(1, 'Split between at least one person'),
  category: z.enum(CATEGORIES),
  date: isoDate,
})
export type AddExpenseInput = z.infer<typeof addExpenseInput>

export const addFriendInput = z.object({
  name: z.string().trim().min(1, 'Enter their name').max(60),
  email: z
    .email('Enter a valid email address')
    .max(254)
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export const friendExpenseInput = z.object({
  description,
  amountCents,
  currency: z.enum(CURRENCIES),
  category: z.enum(CATEGORIES),
  paidBy: z.enum(['me', 'friend']),
  split: z.enum(['equal', 'full']),
  date: isoDate,
})

export type FriendExpenseInput = z.infer<typeof friendExpenseInput>

export const friendPaymentInput = z.object({
  amountCents,
  currency: z.enum(CURRENCIES),
  paidBy: z.enum(['me', 'friend']),
  note: z.string().trim().max(80).optional(),
  date: isoDate,
})
export type FriendPaymentInput = z.infer<typeof friendPaymentInput>

export const personalExpenseInput = z.object({
  description,
  amountCents,
  currency: z.enum(CURRENCIES),
  category: z.enum(CATEGORIES),
  date: isoDate,
})
export type PersonalExpenseInput = z.infer<typeof personalExpenseInput>

// --- Forms ----------------------------------------------------------------

export const OTP_LENGTH = 6

export const emailOtpRequest = z.object({
  email: z.email('Enter a valid email address'),
})

export const emailOtpVerify = emailOtpRequest.extend({
  otp: z
    .string()
    .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit code`),
})

// Email-code sign-ups start without a name and are asked for one; Google
// sign-ups use the name on the Google account. convex/auth.ts re-checks it.
export const NAME_MAX_LENGTH = 80

export const profileName = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your full name')
    .max(NAME_MAX_LENGTH, `Keep it under ${NAME_MAX_LENGTH} characters`),
})
