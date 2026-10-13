import {
  BedDouble,
  Car,
  Receipt,
  ShoppingBag,
  Ticket,
  Utensils,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import type { Category } from '#/lib/schemas'
import { cn } from '#/lib/utils'

// Each category's icon and colour, the same wherever an expense is shown.
export const CATEGORY_STYLE: Record<Category, { icon: LucideIcon; color: string }> = {
  food: { icon: Utensils, color: '#FF9B6A' },
  groceries: { icon: ShoppingBag, color: '#F28DB2' },
  transport: { icon: Car, color: '#7CB8FF' },
  lodging: { icon: BedDouble, color: '#5FD3A0' },
  utilities: { icon: Zap, color: '#F2C14E' },
  entertainment: { icon: Ticket, color: '#B18CFF' },
  other: { icon: Receipt, color: '#A0A2AB' },
}

/** A category's icon in a small tile. */
export function CategoryIcon({
  category,
  className,
}: {
  category: Category
  className?: string
}) {
  const { icon: Icon, color } = CATEGORY_STYLE[category]
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-8.5 shrink-0 place-items-center rounded-[10px] bg-tile [&_svg]:size-4',
        className,
      )}
      style={{ color }}
    >
      <Icon />
    </span>
  )
}

// Colours for things the user names (groups); picked from the name's key so
// a group keeps its colour everywhere.
const FILLS = ['#5FD3A0', '#F28DB2', '#F2C14E', '#7CB8FF', '#B18CFF', '#FF9B6A']

export function hashIndex(key: string, length: number) {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return hash % length
}

export function groupColor(id: string) {
  return FILLS[hashIndex(id, FILLS.length)]
}
