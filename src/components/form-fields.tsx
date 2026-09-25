import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '#/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { categoryLabel } from '#/lib/format'
import {
  CATEGORIES,
  CURRENCIES,
  type Category,
  type Currency,
} from '#/lib/schemas'
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
