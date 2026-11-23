'use client'

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'

import { CATEGORY_STYLE } from '#/components/category'
import { Button } from '#/components/ui/button'
import { Calendar } from '#/components/ui/calendar'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '#/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { categoryLabel, formatDate } from '@settlr/shared/format'
import {
  CATEGORIES,
  CURRENCIES,
  type Category,
  type Currency,
} from '@settlr/shared/schemas'
import { cn } from '#/lib/utils'

// Form controls shared by the expense, payment and filter forms.

export type Option<T extends string> = { value: T; label: string }

/** A Base UI select over a fixed list of options. */
export function SelectField<T extends string>({
  id,
  value,
  onChange,
  options,
  className,
  'aria-label': ariaLabel,
}: {
  id?: string
  value: T
  onChange: (value: T) => void
  options: Array<Option<T>>
  className?: string
  'aria-label'?: string
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next as T)
      }}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn('w-full', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }))
const categoryOptions = CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))

export function CurrencySelect(props: {
  id?: string
  value: Currency
  onChange: (currency: Currency) => void
  className?: string
}) {
  return <SelectField {...props} options={currencyOptions} />
}

export function CategorySelect(props: {
  id?: string
  value: Category
  onChange: (category: Category) => void
  className?: string
}) {
  return <SelectField {...props} options={categoryOptions} />
}

/** The categories as pill toggles; the selected one takes the accent. */
export function CategoryChips({
  value,
  onChange,
}: {
  value: Category
  onChange: (category: Category) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((category) => {
        const Icon = CATEGORY_STYLE[category].icon
        const selected = category === value
        return (
          <button
            key={category}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(category)}
            className={cn(
              // Gr8r's filter chips: a bordered pill button, and the accent
              // chip (accent wash and line) when chosen.
              'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors duration-140 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:h-6.5 sm:px-2 [&_svg]:size-3.5',
              selected
                ? 'border-highlight-border bg-primary-soft text-foreground'
                : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon />
            {categoryLabel(category)}
          </button>
        )
      })}
    </div>
  )
}

/** A money input with the currency code shown inside it. */
export function AmountInput({
  id,
  value,
  onChange,
  currency,
  invalid,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  currency: Currency
  invalid?: boolean
}) {
  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className="tabular-nums"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>{currency}</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  )
}

// The calendar works with local-time Dates; the app stores `YYYY-MM-DD`.
function fromIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function toIsoDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * A date field: a button showing the date that opens shadcn's calendar in a
 * popover. `value` is a `YYYY-MM-DD` string. The label uses the fixed-locale
 * `formatDate`, so it renders the same on the server; the calendar itself
 * only renders in the browser, once opened.
 */
export function DatePicker({
  id,
  value,
  onChange,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? fromIsoDate(value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              'w-full justify-start bg-field px-[calc(--spacing(3)-1px)] font-normal dark:bg-field',
              className,
            )}
          />
        }
      >
        <CalendarIcon className="text-muted-foreground" />
        {value ? formatDate(value) : <span className="text-muted-foreground">Pick a date</span>}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          startMonth={new Date(2000, 0)}
          endMonth={new Date(new Date().getFullYear() + 5, 11)}
          onSelect={(date) => {
            if (!date) return
            onChange(toIsoDate(date))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
