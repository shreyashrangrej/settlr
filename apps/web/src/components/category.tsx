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

// Each category's icon and colour, the same wherever an expense is shown.
// The colours are Gr8r Studio's label hues (`--orange`, `--rose`, ... in
// styles.css), which each theme defines, so they're CSS variables here.
export const CATEGORY_STYLE: Record<Category, { icon: LucideIcon; color: string }> = {
  food: { icon: Utensils, color: 'var(--orange)' },
  groceries: { icon: ShoppingBag, color: 'var(--rose)' },
  transport: { icon: Car, color: 'var(--blue)' },
  lodging: { icon: BedDouble, color: 'var(--teal)' },
  utilities: { icon: Zap, color: 'var(--amber)' },
  entertainment: { icon: Ticket, color: 'var(--violet)' },
  other: { icon: Receipt, color: 'var(--gray)' },
}

/**
 * Gr8r's icon tint (its project icons): a 16% wash of the hue behind the
 * glyph in the hue itself (mixed toward the text colour in dark mode, see
 * `--tint-ink`). Opaque, so stacked tiles don't show through each other.
 */
export function labelTint(color: string): React.CSSProperties {
  return {
    color: `color-mix(in srgb, ${color} var(--tint-ink), var(--text))`,
    background: `color-mix(in srgb, ${color} 16%, var(--surface))`,
  }
}

/** Gr8r's avatar tint: a 17% wash with the initials mixed 55% toward the text. */
export function avatarTint(color: string): React.CSSProperties {
  return {
    color: `color-mix(in srgb, ${color} 55%, var(--text))`,
    background: `color-mix(in srgb, ${color} 17%, var(--surface))`,
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
        'grid size-7 shrink-0 place-items-center rounded-md bg-tile [&_svg]:size-3.5',
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

// Colours for things the user names (groups); picked from the id so a group
// keeps its colour everywhere. Drawn as a tint (`labelTint`), or as a dot.
const FILLS = [
  'var(--green)',
  'var(--rose)',
  'var(--amber)',
  'var(--blue)',
  'var(--violet)',
  'var(--orange)',
  'var(--teal)',
]

export function hashIndex(key: string, length: number) {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return hash % length
}

export function groupColor(id: string) {
  return FILLS[hashIndex(id, FILLS.length)]
}
