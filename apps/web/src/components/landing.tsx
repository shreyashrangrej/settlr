import {
  ArrowLeftRight,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  Coins,
  Handshake,
  LayoutDashboard,
  PiggyBank,
  Plus,
  QrCode,
  ReceiptText,
  Scale,
  ScanLine,
  Split,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { Logo, LogoMark } from '#/components/brand'
import { CategoryIcon, avatarTint, labelTint } from '#/components/category'
import { RobotIcon } from '#/components/robot-icon'
import { DOCS_URL } from '#/lib/site'
import { cn } from '#/lib/utils'
import { formatWholeMoney } from '@settlr/shared/format'
import type { Category } from '@settlr/shared/schemas'

// The signed-out home page's sections (src/app/page.tsx puts the sign-in
// form beside the hero copy). Everything here is static, server-rendered
// markup: the product preview and the feature visuals are drawn with the
// app's own tokens, so they follow the theme and the accent, and they use
// one made-up trip whose numbers add up (see GOA below).

/** The home page's section width, inside the signed-out gutter. */
export const LANDING_WIDTH = 'mx-auto w-full max-w-6xl px-(--gutter)'

// Gr8r's buttons as plain links: `buttonVariants` lives in a client module,
// which a server component can't call.
const linkButton =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border px-4 text-sm font-medium whitespace-nowrap no-underline outline-none transition-[background-color,border-color,color,scale] duration-140 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring active:scale-[0.97] sm:h-9 [&_svg]:size-3.5'
const primaryLink = cn(
  linkButton,
  'border-transparent bg-primary text-primary-foreground shadow-[inset_0_-1px_0_rgb(0_0_0/12%)] hover:bg-[color-mix(in_srgb,var(--accent)_88%,var(--text))]',
)
const outlineLink = cn(linkButton, 'border-input bg-card text-foreground shadow-xs hover:bg-muted')

// ---------------------------------------------------------------------------
// Sample data: four friends in Goa. Seven expenses split equally four ways
// (₹24,800, so ₹6,200 each), which leaves you +₹5,800, Priya +₹600,
// Sam −₹1,800 and Rohan −₹4,600. That's 21 IOUs (three per expense), and
// the settle-up plan clears them in three payments.

const inr = (rupees: number) => formatWholeMoney(rupees * 100, 'INR')
const signed = (rupees: number) => `${rupees > 0 ? '+' : '−'}${inr(Math.abs(rupees))}`

type Person = { name: string; full: string; initials: string; hue?: string }
const YOU: Person = { name: 'You', full: 'Alex Morgan (you)', initials: 'AM' }
const PRIYA: Person = { name: 'Priya', full: 'Priya Shah', initials: 'PS', hue: 'var(--rose)' }
const SAM: Person = { name: 'Sam', full: 'Sam Carter', initials: 'SC', hue: 'var(--blue)' }
const ROHAN: Person = { name: 'Rohan', full: 'Rohan Das', initials: 'RD', hue: 'var(--teal)' }

const GOA = {
  expenses: [
    { title: 'Beach shack lunch', category: 'food', date: 'Nov 23', paidBy: SAM, amount: 1200 },
    { title: 'Airport taxi', category: 'transport', date: 'Nov 23', paidBy: ROHAN, amount: 1600 },
    { title: 'Groceries for the villa', category: 'groceries', date: 'Nov 22', paidBy: PRIYA, amount: 2000 },
    { title: 'Snorkelling trip', category: 'entertainment', date: 'Nov 22', paidBy: SAM, amount: 3200 },
    { title: 'Scooter rental', category: 'transport', date: 'Nov 21', paidBy: YOU, amount: 2400 },
    { title: 'Seafood dinner', category: 'food', date: 'Nov 20', paidBy: PRIYA, amount: 4800 },
    { title: 'Beach villa, 2 nights', category: 'lodging', date: 'Nov 20', paidBy: YOU, amount: 9600 },
  ] satisfies Array<{ title: string; category: Category; date: string; paidBy: Person; amount: number }>,
  balances: [
    { person: YOU, net: 5800 },
    { person: PRIYA, net: 600 },
    { person: SAM, net: -1800 },
    { person: ROHAN, net: -4600 },
  ],
  plan: [
    { from: ROHAN, to: YOU, amount: 4600 },
    { from: SAM, to: YOU, amount: 1200 },
    { from: SAM, to: PRIYA, amount: 600 },
  ],
  total: 24800,
  share: 6200,
}

function Avatar({ person, className }: { person: Person; className?: string }) {
  return (
    <span
      className={cn(
        'grid size-6 shrink-0 place-items-center rounded-full text-3xs font-semibold',
        !person.hue && 'bg-primary-soft text-primary',
        className,
      )}
      style={person.hue ? avatarTint(person.hue) : undefined}
    >
      {person.initials}
    </span>
  )
}

function Money({ rupees, className }: { rupees: number; className?: string }) {
  return (
    <span
      className={cn(
        'font-medium whitespace-nowrap tabular-nums',
        rupees > 0 ? 'text-positive' : 'text-destructive',
        className,
      )}
    >
      {signed(rupees)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Hero copy

const FACTS: Array<{ icon: LucideIcon; label: string }> = [
  { icon: Scale, label: 'Fair to the cent' },
  { icon: Coins, label: 'Six currencies' },
  { icon: QrCode, label: 'Pay back over UPI' },
]

/** The headline, the pitch and three facts, beside the sign-in form. */
export function HeroCopy() {
  return (
    <div className="grid justify-items-start gap-6 lg:gap-7">
      <a
        href={`${DOCS_URL}/guide/assistant`}
        className="group inline-flex animate-rise-in items-center gap-2 rounded-full border bg-card py-1 pr-2.5 pl-1 text-xs font-medium text-muted-foreground no-underline shadow-xs transition-colors duration-140 hover:border-input hover:text-foreground"
      >
        <span className="grid size-5 place-items-center rounded-full bg-primary-soft text-primary">
          <RobotIcon className="size-3.5" />
        </span>
        Add expenses just by typing them
        <ArrowRight className="size-3 text-dim transition-transform duration-140 group-hover:translate-x-0.5" />
      </a>

      <h1
        id="hero-title"
        className="m-0 animate-rise-in text-[clamp(2.75rem,6.4vw,4.75rem)] leading-[0.98] font-semibold tracking-[-0.045em] text-balance [animation-delay:50ms]"
      >
        Split costs.
        <br />
        <span className="text-primary">Stay friends.</span>
      </h1>

      <p className="max-w-[34rem] animate-rise-in text-lg leading-relaxed text-muted-foreground [animation-delay:100ms] sm:text-xl sm:leading-relaxed">
        Settlr keeps one shared tab for trips, flats and dinners, then works out the fewest
        payments to get everyone square.
      </p>

      <ul className="flex animate-rise-in flex-wrap gap-x-5 gap-y-2.5 text-sm text-muted-foreground [animation-delay:150ms]">
        {FACTS.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-center gap-2">
            <Icon aria-hidden="true" className="size-4 text-dim" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Product preview: the group page, as the app draws it from `lg`.

const sideRow =
  'flex h-7.5 items-center gap-2.25 rounded-lg px-2 text-sm whitespace-nowrap text-muted-foreground [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-dim'
const sideRowActive =
  'bg-card font-medium text-foreground shadow-[0_1px_2px_rgb(0_0_0/5%),0_0_0_1px_var(--border)] dark:bg-foreground/10 dark:shadow-none'
const sideHeading = 'flex h-6 items-center px-2 text-2xs font-semibold tracking-[0.06em] text-faint uppercase'
const fakeButton =
  'inline-flex h-7.5 items-center gap-1.5 rounded-lg border px-[11px] text-ui font-medium whitespace-nowrap [&>svg]:size-3.5'

function PreviewSidebar() {
  return (
    <div className="hidden w-52 shrink-0 flex-col gap-4 p-2.5 md:flex">
      <span className="flex h-9 items-center gap-2 px-1.5">
        <LogoMark className="size-6" />
        <span className="text-sm font-semibold">settlr</span>
      </span>
      <div className="grid gap-0.5">
        <span className={sideRow}>
          <LayoutDashboard />
          Dashboard
        </span>
        <span className={sideRow}>
          <RobotIcon />
          AI Assistant
        </span>
      </div>
      <div className="grid gap-0.5">
        <span className={sideHeading}>Expenses</span>
        <span className={sideRow}>
          <ReceiptText />
          All expenses
        </span>
        <span className={sideRow}>
          <Users />
          Groups
        </span>
        <span className={sideRow}>
          <User />
          Friends
        </span>
        <span className={sideRow}>
          <Wallet />
          Personal
        </span>
        <span className={sideRow}>
          <PiggyBank />
          Budget
        </span>
      </div>
      <div className="grid gap-0.5">
        <span className={sideHeading}>Groups</span>
        <span className={cn(sideRow, sideRowActive)}>
          <span className="size-2 rounded-full bg-[var(--teal)]" />
          <span className="flex-1">Goa trip</span>
          <span className="text-xs text-positive tabular-nums">{signed(5800)}</span>
        </span>
        <span className={sideRow}>
          <span className="size-2 rounded-full bg-[var(--rose)]" />
          <span className="flex-1">Flat 4B</span>
          <span className="text-xs text-destructive tabular-nums">{signed(-850)}</span>
        </span>
      </div>
    </div>
  )
}

function PreviewTopBar() {
  return (
    <div className="flex h-11 items-center gap-1.5 px-1.5 md:px-4">
      <span className="flex min-w-0 items-center gap-1.5 text-ui text-muted-foreground">
        Groups
        <span className="text-dim">/</span>
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <span className="size-2 rounded-full bg-[var(--teal)]" />
          Goa trip
        </span>
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        <span className="relative grid size-7.5 place-items-center text-muted-foreground">
          <Bell className="size-4" />
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
        </span>
        <span className={cn(fakeButton, 'h-6.5 gap-1 bg-card px-2 text-xs max-sm:hidden')}>
          <Plus />
          New
          <ChevronDown className="size-3!" />
        </span>
        <Avatar person={YOU} className="size-6.5" />
      </span>
    </div>
  )
}

function PreviewStats() {
  const stats = [
    { label: 'Total spent', value: inr(GOA.total), hint: `${GOA.expenses.length} expenses`, tone: '' },
    { label: 'Your share', value: inr(GOA.share), hint: 'A quarter of it', tone: '' },
    { label: 'You’re owed', value: signed(5800), hint: '3 payments settle it', tone: 'text-positive' },
  ]
  return (
    <div className="grid grid-cols-3 divide-x rounded-xl border bg-card">
      {stats.map((stat) => (
        <div key={stat.label} className="grid min-w-0 gap-1 px-3 py-3 sm:px-4">
          <span className="truncate text-xs text-muted-foreground sm:text-ui">{stat.label}</span>
          <span className={cn('text-base font-semibold tracking-tight tabular-nums sm:text-[22px] sm:leading-tight', stat.tone)}>
            {stat.value}
          </span>
          <span className="truncate text-xs text-faint max-sm:hidden">{stat.hint}</span>
        </div>
      ))}
    </div>
  )
}

function PreviewExpenses() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex h-8.5 items-center gap-3 border-b px-3.5 text-xs font-medium text-muted-foreground">
        <span className="flex-1">Description</span>
        <span className="w-24 max-sm:hidden">Paid by</span>
        <span className="w-24 text-right sm:w-28">Amount</span>
      </div>
      <ul className="divide-y divide-divider">
        {GOA.expenses.map((expense) => (
          <li key={expense.title} className="flex h-13 items-center gap-3 px-3.5">
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <CategoryIcon category={expense.category} />
              <span className="grid min-w-0">
                <span className="truncate text-sm font-medium">{expense.title}</span>
                <span className="truncate text-xs text-faint">{expense.date}</span>
              </span>
            </span>
            <span className="flex w-24 items-center gap-1.5 truncate text-sm max-sm:hidden">
              <Avatar person={expense.paidBy} className="size-5 text-[9px]" />
              {expense.paidBy.name}
            </span>
            <span className="grid w-24 justify-items-end text-sm font-medium tabular-nums sm:w-28">
              {inr(expense.amount)}
              <span className="text-xs font-normal text-faint">
                <span className="max-sm:hidden">Your share </span>
                {inr(expense.amount / 4)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PreviewAside() {
  return (
    <div className="hidden content-start gap-4 lg:grid">
      <div className="grid gap-3 rounded-xl border bg-card p-3.5">
        <div className="grid gap-0.5">
          <span className="text-sm font-semibold">Balances</span>
          <span className="text-xs text-muted-foreground">Paid minus share</span>
        </div>
        <ul className="grid gap-2.5">
          {GOA.balances.map(({ person, net }) => (
            <li key={person.initials} className="flex items-center gap-2 text-sm">
              <Avatar person={person} />
              <span className="flex-1 truncate">{person.full}</span>
              <Money rupees={net} />
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-3 rounded-xl border bg-card p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">Settle up</span>
          <span className="text-xs text-faint">3 payments</span>
        </div>
        <ul className="grid gap-2">
          {GOA.plan.map(({ from, to, amount }) => (
            <li
              key={`${from.initials}-${to.initials}`}
              className="flex items-center gap-2 rounded-lg bg-tile px-2.5 py-2 text-sm"
            >
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                {from.name}
                <ArrowRight aria-hidden="true" className="size-3 shrink-0 text-dim" />
                {to === YOU ? 'you' : to.name}
              </span>
              <span className="font-medium tabular-nums">{inr(amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * A still of a group's page inside the app's frame. Decorative for screen
 * readers, which get the caption instead.
 */
export function AppPreview() {
  return (
    <figure className="relative m-0">
      {/* The accent glows faintly from behind the window. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-[8%] -top-8 -z-10 h-3/4 rounded-full bg-primary/20 blur-3xl dark:bg-primary/12"
      />
      <div
        aria-hidden="true"
        className="flex overflow-hidden rounded-2xl border frame-art shadow-[0_40px_100px_-40px_rgb(28_25_20/45%)] select-none dark:shadow-[0_40px_100px_-30px_rgb(0_0_0/80%)]"
      >
        <PreviewSidebar />
        <div className="flex min-w-0 flex-1 flex-col px-1.5 pb-1.5 md:pr-2 md:pb-2 md:pl-0">
          <PreviewTopBar />
          <div className="grid gap-4 rounded-xl border bg-background p-3.5 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-lg"
                  style={labelTint('var(--teal)')}
                >
                  <Users className="size-5" />
                </span>
                <span className="grid min-w-0 gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-xl font-semibold tracking-[-0.022em] sm:text-2xl">
                      Goa trip
                    </span>
                    <span className="rounded-md border bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                      INR
                    </span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    4 people · {inr(GOA.total)} spent
                  </span>
                </span>
              </div>
              <span className="flex gap-1.5 max-sm:hidden">
                <span className={cn(fakeButton, 'border-input bg-card shadow-xs')}>
                  <ArrowLeftRight />
                  Settle up
                </span>
                <span className={cn(fakeButton, 'border-transparent bg-primary text-primary-foreground')}>
                  <Plus />
                  Add expense
                </span>
              </span>
            </div>
            <PreviewStats />
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_15.5rem] xl:grid-cols-[minmax(0,1fr)_17.5rem]">
              <PreviewExpenses />
              <PreviewAside />
            </div>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">
        A group in Settlr for a trip to Goa: seven expenses split four ways, everyone’s balance,
        and a plan that settles up in three payments.
      </figcaption>
    </figure>
  )
}

// ---------------------------------------------------------------------------
// Features

function Feature({
  icon: Icon,
  hue,
  title,
  children,
  visual,
  wide = false,
  className,
}: {
  icon: LucideIcon
  hue: string
  title: string
  children: React.ReactNode
  visual: React.ReactNode
  /** Spans two columns, with the visual beside the text from `lg`. */
  wide?: boolean
  className?: string
}) {
  return (
    <article
      className={cn(
        'group/feature flex flex-col overflow-hidden rounded-xl border bg-card transition-[border-color,translate] duration-200 ease-out-quint hover:-translate-y-0.5 hover:border-input',
        wide && 'md:col-span-2 lg:flex-row',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          // One height for the narrow cards, so their titles line up across a
          // row; the wide ones grow to fit their bigger visuals.
          'relative grid place-items-center overflow-hidden border-b bg-sunken px-5 py-6',
          wide ? 'min-h-44' : 'h-44',
          // A faint dot grid, as behind the hero.
          'bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:16px_16px]',
          wide && 'lg:order-last lg:w-[55%] lg:border-b-0 lg:border-l',
        )}
      >
        {visual}
      </div>
      <div className={cn('grid content-start gap-2 p-5', wide && 'lg:flex-1 lg:content-center lg:p-7')}>
        <span className="grid size-8 place-items-center rounded-lg" style={labelTint(hue)}>
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <h3 className="m-0 mt-1 text-base font-semibold">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </article>
  )
}

/** A small floating surface inside a feature's visual. */
function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('w-full rounded-xl border bg-card p-3 shadow-[0_8px_24px_-12px_rgb(28_25_20/18%)] dark:shadow-none', className)}>
      {children}
    </div>
  )
}

function SplitVisual() {
  const rows = [
    { person: PRIYA, shares: 2, amount: 2400, hue: 'var(--rose)' },
    { person: SAM, shares: 1, amount: 1200, hue: 'var(--blue)' },
    { person: YOU, shares: 1, amount: 1200, hue: 'var(--accent)' },
  ]
  return (
    <Panel className="grid max-w-sm gap-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <CategoryIcon category="food" className="size-6" />
          Seafood dinner
        </span>
        <span className="font-semibold tabular-nums">{inr(4800)}</span>
      </div>
      <div className="grid grid-cols-4 rounded-lg bg-raised p-0.5 text-center text-xs font-medium text-muted-foreground">
        <span className="py-1">Equally</span>
        <span className="py-1">Amounts</span>
        <span className="py-1">%</span>
        <span className="rounded-md bg-segment py-1 text-foreground shadow-[0_1px_2px_rgb(0_0_0/6%),0_0_0_1px_var(--border)]">
          Shares
        </span>
      </div>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        {rows.map((row) => (
          <span
            key={row.person.initials}
            className="h-full origin-left animate-grow-x rounded-full"
            style={{ flex: row.shares, background: row.hue }}
          />
        ))}
      </div>
      <ul className="grid gap-2">
        {rows.map(({ person, shares, amount }) => (
          <li key={person.initials} className="flex items-center gap-2 text-sm">
            <Avatar person={person} />
            <span className="flex-1">{person.name}</span>
            <span className="rounded-md border bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
              ×{shares}
            </span>
            <span className="w-16 text-right font-medium tabular-nums">{inr(amount)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function SettleVisual() {
  return (
    <div className="flex items-center gap-4">
      <div className="grid justify-items-center">
        <span className="text-4xl font-semibold tracking-tight text-dim tabular-nums line-through decoration-2">
          21
        </span>
        <span className="text-xs text-faint">IOUs</span>
      </div>
      <ArrowRight className="size-5 text-dim" />
      <div className="grid justify-items-center">
        <span className="text-4xl font-semibold tracking-tight text-positive tabular-nums">3</span>
        <span className="text-xs text-muted-foreground">payments</span>
      </div>
    </div>
  )
}

function FriendsVisual() {
  return (
    <Panel className="grid max-w-64 gap-2.5">
      <div className="flex items-center gap-2 text-sm">
        <Avatar person={SAM} />
        <span className="grid flex-1 leading-tight">
          Sam Carter
          <span className="text-xs text-faint">owes you</span>
        </span>
        <Money rupees={1250} />
      </div>
      <div className="h-px bg-divider" />
      <div className="flex items-center gap-2 text-sm">
        <Avatar person={PRIYA} />
        <span className="grid flex-1 leading-tight">
          Priya Shah
          <span className="text-xs text-faint">you owe</span>
        </span>
        <Money rupees={-400} />
      </div>
    </Panel>
  )
}

function AssistantVisual() {
  return (
    <div className="grid w-full max-w-sm gap-3">
      <p className="m-0 max-w-[85%] justify-self-end rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
        Taxi 600 in the Goa trip, paid by Priya
      </p>
      <div className="flex items-start gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <RobotIcon className="size-3.5" />
        </span>
        <Panel className="grid gap-2.5 p-2.5">
          <div className="flex items-center gap-2.5">
            <CategoryIcon category="transport" />
            <span className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate text-sm font-medium">Taxi</span>
              <span className="truncate text-xs text-faint">Goa trip · Paid by Priya</span>
            </span>
            <span className="text-sm font-semibold tabular-nums">{inr(600)}</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="grid size-4 place-items-center rounded-full bg-positive/15 text-positive">
              <Check className="size-2.5" strokeWidth={3} />
            </span>
            Added · {inr(150)} each, 4 ways
          </span>
        </Panel>
      </div>
    </div>
  )
}

function BudgetVisual() {
  return (
    <Panel className="grid max-w-64 gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">November budget</span>
        <span className="text-xs text-faint">62%</span>
      </div>
      <span className="text-lg font-semibold tracking-tight tabular-nums">
        {inr(18600)} <span className="text-sm font-normal text-faint">of {inr(30000)}</span>
      </span>
      <div className="h-1.5 overflow-hidden rounded-full bg-track">
        <span className="block h-full w-[62%] origin-left animate-grow-x rounded-full bg-primary" />
      </div>
      <span className="text-xs text-faint">{inr(11400)} left this month</span>
    </Panel>
  )
}

function ReceiptVisual() {
  return (
    <div className="flex w-full max-w-64 items-center gap-3">
      <div className="grid w-16 shrink-0 gap-1.5 rounded-md border bg-card px-2 py-2.5 shadow-xs">
        {['w-8', 'w-full', 'w-10', 'w-full', 'w-7'].map((width, i) => (
          <span key={i} className={cn('h-1 rounded-full bg-raised', width)} />
        ))}
        <span className="mt-1 h-1.5 w-9 justify-self-end rounded-full bg-dim/50" />
      </div>
      <ScanLine className="size-4 shrink-0 text-primary" />
      <Panel className="grid gap-1.5 p-2.5 text-xs">
        <span className="text-faint">Description</span>
        <span className="text-sm font-medium">Seafood dinner</span>
        <span className="text-faint">Amount</span>
        <span className="text-sm font-medium tabular-nums">{inr(4800)}</span>
      </Panel>
    </div>
  )
}

function UpiVisual() {
  return (
    <Panel className="flex max-w-64 items-center gap-3">
      <span className="grid size-14 shrink-0 place-items-center rounded-lg border bg-background">
        <QrCode className="size-9 text-foreground" strokeWidth={1.4} />
      </span>
      <span className="grid min-w-0 gap-1">
        <span className="flex items-center gap-1.5 text-sm">
          Rohan
          <ArrowRight className="size-3 text-dim" />
          you
        </span>
        <span className="text-lg leading-none font-semibold tabular-nums">{inr(4600)}</span>
        <span className="text-xs text-faint">GPay, PhonePe, Paytm…</span>
      </span>
    </Panel>
  )
}

/** What Settlr does, as a grid of cards that each show a piece of it. */
export function FeatureGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Feature wide icon={Split} hue="var(--violet)" title="Split it any way" visual={<SplitVisual />}>
        Equally, by exact amounts, by percentage or by shares, for groups of up to 20. Every
        split adds up to the cent, and you see everyone’s part before you save.
      </Feature>
      <Feature
        icon={ArrowLeftRight}
        hue="var(--green)"
        title="The fewest payments"
        visual={<SettleVisual />}
      >
        Settlr nets out who owes whom and plans the fewest transfers that get everyone square.
      </Feature>
      <Feature icon={Handshake} hue="var(--rose)" title="Friends, one-on-one" visual={<FriendsVisual />}>
        A running tab with each friend, in any of six currencies, shared with them once they
        accept.
      </Feature>
      <Feature
        wide
        icon={RobotIcon}
        hue="var(--blue)"
        title="Just tell the assistant"
        visual={<AssistantVisual />}
      >
        Type what you spent and who shared it, and the assistant adds it. Find and fix expenses
        the same way, here or from Claude and ChatGPT.
      </Feature>
      <Feature icon={PiggyBank} hue="var(--amber)" title="Your own budget" visual={<BudgetVisual />}>
        Personal spending by month and category, against a budget that counts your share of
        everything.
      </Feature>
      <Feature icon={ReceiptText} hue="var(--orange)" title="Receipts, read for you" visual={<ReceiptVisual />}>
        Attach a photo or PDF to any expense, or let Settlr fill in the form from the receipt.
      </Feature>
      <Feature
        icon={QrCode}
        hue="var(--teal)"
        title="Pay back over UPI"
        visual={<UpiVisual />}
        className="md:col-span-2 lg:col-span-1"
      >
        Settle up from any UPI app with the amount filled in, or scan the code on a computer.
      </Feature>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Closing call to action and footer

/** The last section: back up to the sign-in form, or off to the guide. */
export function ClosingCta() {
  return (
    <div className="relative isolate overflow-hidden rounded-2xl border frame-art px-6 py-14 text-center sm:px-10 sm:py-16">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(var(--border-strong)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_50%,#000_20%,transparent_100%)]"
      />
      <LogoMark className="mx-auto size-11" />
      <h2
        id="cta-title"
        className="m-0 mt-5 text-[clamp(1.75rem,3.6vw,2.5rem)] leading-tight font-semibold tracking-[-0.035em] text-balance"
      >
        Start your first shared tab
      </h2>
      <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
        Sign in with Google or an email code. There’s no password, and a new account takes
        seconds.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <a href="#sign-in" className={primaryLink}>
          Get started
          <ArrowRight />
        </a>
        <a href={`${DOCS_URL}/guide/getting-started`} className={outlineLink}>
          Read the guide
        </a>
      </div>
    </div>
  )
}

export function LandingFooter() {
  const links = [
    { href: `${DOCS_URL}/guide/getting-started`, label: 'Guide' },
    { href: `${DOCS_URL}/development`, label: 'Developers' },
    { href: '/settings', label: 'Settings' },
  ]
  return (
    <footer className="border-t">
      <div
        className={cn(
          LANDING_WIDTH,
          'flex flex-wrap items-center justify-between gap-x-6 gap-y-4 py-8 text-sm text-muted-foreground',
        )}
      >
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Logo />
          <span className="text-faint">Split costs. Stay friends.</span>
        </span>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-muted-foreground no-underline transition-colors duration-140 hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <span className="text-faint">MIT licensed</span>
        </nav>
      </div>
    </footer>
  )
}
