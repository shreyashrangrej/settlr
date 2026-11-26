'use client'

import { SelectField } from '#/components/form-fields'
import type { Frequency } from '@settlr/shared/schemas'

export type Repeat = 'never' | Frequency

/** "Repeats": never, or weekly/monthly/yearly from the expense's date. */
export function RepeatSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: Repeat
  onChange: (value: Repeat) => void
}) {
  return (
    <SelectField
      id={id}
      value={value}
      onChange={onChange}
      options={[
        { value: 'never', label: 'Doesn’t repeat' },
        { value: 'weekly', label: 'Every week' },
        { value: 'monthly', label: 'Every month' },
        { value: 'yearly', label: 'Every year' },
      ]}
    />
  )
}

export const REPEAT_HINT =
  'Settlr adds it on each due date (from the date above). Manage repeats on the Recurring page.'
