import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'

export function PageSpinner() {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>Loading…</span>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="state">
      <h2>Not found</h2>
      <p className="muted">That page or group doesn’t exist.</p>
      <Link to="/" className="button">
        Back to groups
      </Link>
    </div>
  )
}

export function ErrorState({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <div className="state" role="alert">
      <h2>Something went wrong</h2>
      <p className="muted">
        {error instanceof Error ? error.message : 'Unexpected error'}
      </p>
      <button
        type="button"
        className="button"
        onClick={() => {
          reset()
          void router.invalidate()
        }}
      >
        Try again
      </button>
    </div>
  )
}
