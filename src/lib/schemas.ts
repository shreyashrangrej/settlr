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
export const PAGE_SIZE = 8

const id = z.string().trim().min(1).max(64)
const isoDate = z.iso.date()

// --- Search params --------------------------------------------------------

export const expenseSearchDefaults = {
  q: '',
  category: 'all',
  paidBy: '',
  sort: 'date',
  order: 'desc',
  page: 1,
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
  page: z.number().int().min(1).max(10_000).default(1).catch(1),
})
export type ExpenseSearch = z.infer<typeof expenseSearchSchema>

// --- Server function input ------------------------------------------------

export const groupIdInput = z.object({ groupId: id })

export const listExpensesInput = expenseSearchSchema.extend({ groupId: id })

export const createGroupInput = z.object({
  name: z.string().trim().min(1, 'Give the group a name').max(60),
  currency: z.enum(CURRENCIES),
  members: z
    .array(z.string().trim().min(1).max(40))
    .min(2, 'A group needs at least two members')
    .max(20)
    .refine(
      (names) =>
        new Set(names.map((n) => n.toLowerCase())).size === names.length,
      'Member names must be unique',
    ),
})
export type CreateGroupInput = z.infer<typeof createGroupInput>

export const addExpenseInput = z.object({
  groupId: id,
  description: z.string().trim().min(1, 'Describe the expense').max(80),
  // Integer minor units (cents); never floats for money.
  amountCents: z
    .number()
    .int()
    .positive('Amount must be greater than zero')
    .max(100_000_000),
  paidBy: id,
  splitAmong: z.array(id).min(1, 'Split between at least one person'),
  category: z.enum(CATEGORIES),
  date: isoDate,
})
export type AddExpenseInput = z.infer<typeof addExpenseInput>

export const deleteExpenseInput = z.object({ groupId: id, expenseId: id })

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
