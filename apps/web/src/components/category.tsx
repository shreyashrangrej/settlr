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

import type { Category } from '@settlr/shared/schemas'
import { cn } from '#/lib/utils'

// Each category's icon and colour, the same wherever an expense is shown
// (Tailwind's 400 shades).
export const CATEGORY_STYLE: Record<Category, { icon: LucideIcon; color: string }> = {
  food: { icon: Utensils, color: '#FB923C' },
  groceries: { icon: ShoppingBag, color: '#F472B6' },
  transport: { icon: Car, color: '#60A5FA' },
  lodging: { icon: BedDouble, color: '#34D399' },
  utilities: { icon: Zap, color: '#FBBF24' },
  entertainment: { icon: Ticket, color: '#A78BFA' },
  other: { icon: Receipt, color: '#A3A3A3' },
}

/**
 * T3 Code's label tint: a faint wash of the colour behind a foreground-mixed
 * version of it, so it reads in both themes. Opaque, so stacked avatars
 * don't show through each other.
 */
export function labelTint(color: string): React.CSSProperties {
  return {
    color: `color-mix(in srgb, ${color} 78%, var(--text))`,
    background: `color-mix(in srgb, ${color} 14%, var(--surface))`,
  }
}

/** An icon in the small tile that starts a list row. */
export function IconTile({
  className,
  style,
  children,
}: {
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-lg bg-tile [&_svg]:size-4',
        className,
      )}
      style={style}
    >
      {children}
    </span>
  )
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
    <IconTile className={className} style={labelTint(color)}>
      <Icon />
    </IconTile>
  )
}

// Colours for things the user names (groups); picked from the name's key so
// a group keeps its colour everywhere. Text on them is `on-fill` (dark).
const FILLS = ['#34D399', '#F472B6', '#FBBF24', '#60A5FA', '#A78BFA', '#FB923C']

export function hashIndex(key: string, length: number) {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return hash % length
}

export function groupColor(id: string) {
  return FILLS[hashIndex(id, FILLS.length)]
}
