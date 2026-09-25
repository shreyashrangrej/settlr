'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startTransition } from 'react'
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
import { errorMessage } from '#/lib/errors'

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
        <Link href="/" className={buttonVariants({ variant: 'outline' })}>
          Go home
        </Link>
      </EmptyContent>
    </Empty>
  )
}

export function ErrorState({ error, reset }: { error: Error; reset: () => void }) {
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
          onClick={() =>
            // Load the page's data again, then retry rendering it.
            startTransition(() => {
              router.refresh()
              reset()
            })
          }
        >
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  )
}
