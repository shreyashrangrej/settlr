import type { z } from 'zod'

// URL search params, validated by the zod schemas in schemas.ts. Pages parse
// them on the server (invalid values fall back to defaults instead of
// throwing) and pass the result to their client components; links build
// URLs with `searchHref`, which leaves defaults out so URLs stay clean.

type SearchParams = Record<string, string | Array<string> | undefined>

/** Parses a page's `searchParams` with `schema`. */
export function parseSearch<T extends z.ZodType>(schema: T, params: SearchParams): z.infer<T> {
  const flat = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  )
  return schema.parse(flat)
}

/** `pathname` with `values` as search params, minus those equal to `defaults`. */
export function searchHref<T extends Record<string, string | number>>(
  pathname: string,
  values: T,
  defaults: Partial<T>,
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== defaults[key]) params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
