import { PageSkeleton } from '#/components/skeletons'

// The default while a signed-in page loads; most pages have their own.
export default function Loading() {
  return <PageSkeleton />
}
