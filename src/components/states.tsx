import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { CircleAlert, SearchX } from 'lucide-react'

import { Button, buttonVariants } from '#/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '#/components/ui/empty'
import { Spinner } from '#/components/ui/spinner'
import { errorMessage } from '#/lib/errors'

export function PageSpinner() {
  return (
    <div
      className="grid place-items-center gap-3 py-24 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-6 text-primary" />
      Loading…
    </div>
  )
}

export function NotFound() {
  return (
    <Empty className="py-20">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>Not found</EmptyTitle>
        <EmptyDescription>That page doesn’t exist, or it isn’t yours.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link to="/" className={buttonVariants({ variant: 'outline' })}>
          Go home
        </Link>
      </EmptyContent>
    </Empty>
  )
}

export function ErrorState({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <Empty className="py-20" role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="bg-destructive/15 text-destructive">
          <CircleAlert />
        </EmptyMedia>
        <EmptyTitle>Something went wrong</EmptyTitle>
        <EmptyDescription>{errorMessage(error)}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          variant="outline"
          onClick={() => {
            reset()
            void router.invalidate()
          }}
        >
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  )
}
