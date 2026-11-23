// Shared by the dashboard's server page (which prefetches) and its view
// (which reads), so both pass the same args; Convex hashes the query key
// with JSON.stringify, so the key order matters too. Not in the view's
// 'use client' module, whose exports a server component can't read.

/** The dashboard's slice of the All expenses list: the newest few, unfiltered. */
export const RECENT_ARGS = {
  q: '',
  category: 'all',
  source: 'all',
  sort: 'date',
  order: 'desc',
  limit: 5,
} as const
