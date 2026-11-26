'use client'

import { Hash } from 'lucide-react'

import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'

// Tags on an expense ("goa-trip", "work"): typed separated by commas, and
// cleaned the same way Convex does (convex/lib/input.ts): lowercase, no
// leading #, spaces inside a tag become hyphens ("Goa Trip" → goa-trip).

export function parseTags(text: string) {
  return [
    ...new Set(
      text
        .split(',')
        .map((t) => t.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-'))
        .filter(Boolean),
    ),
  ].slice(0, 5)
}

export function TagInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Input
      id={id}
      value={value}
      maxLength={130}
      placeholder="goa-trip, work"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** Small "#tag" chips, for rows and cards. */
export function TagList({ tags, className }: { tags: Array<string>; className?: string }) {
  if (tags.length === 0) return null
  return (
    <span className={cn('inline-flex flex-wrap gap-1', className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 rounded-md bg-tile px-1.5 py-px text-2xs font-medium text-muted-foreground"
        >
          <Hash className="size-2.5" aria-hidden="true" />
          {tag}
        </span>
      ))}
    </span>
  )
}
