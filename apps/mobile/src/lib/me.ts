import { api } from '@settlr/backend/convex/_generated/api'
import { useQuery } from 'convex/react'

import { authClient } from '@/lib/auth-client'

/** The signed-in user, read through Convex (the session fills in until it loads). */
export function useMe() {
  const { data: session } = authClient.useSession()
  const user = useQuery(api.auth.getCurrentUser)
  const fallback = session?.user
  return {
    name: (user?.name ?? fallback?.name ?? '').trim(),
    email: user?.email ?? fallback?.email ?? '',
    /** False until Convex has answered, so an empty name is really empty. */
    loaded: user !== undefined,
  }
}
