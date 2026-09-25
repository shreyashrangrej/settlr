import { Label } from '#/components/ui/label'
import { NativeSelect } from '#/components/ui/native-select'
import { categoryLabel } from '#/lib/format'
import {
  CATEGORIES,
  CURRENCIES,
  type Category,
  type Currency,
} from '#/lib/schemas'

// Form controls shared by the expense and payment forms.

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

export function CurrencySelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: Currency
  onChange: (currency: Currency) => void
}) {
  return (
    <NativeSelect
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as Currency)}
    >
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </NativeSelect>
  )
}

export function CategorySelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: Category
  onChange: (category: Category) => void
}) {
  return (
    <NativeSelect
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as Category)}
    >
      {CATEGORIES.map((c) => (
        <option key={c} value={c}>
          {categoryLabel(c)}
        </option>
      ))}
    </NativeSelect>
  )
}
