// The same arguments (in the same key order, which Convex hashes) for the
// page's prefetch and the view's query: the month's biggest expenses first.
export function recapArgs(month: string) {
  return {
    month,
    q: '',
    category: 'all' as const,
    source: 'all' as const,
    sort: 'amount' as const,
    order: 'desc' as const,
    limit: 5,
    tag: '',
  }
}
