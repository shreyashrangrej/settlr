import type { Metadata } from 'next'

import { LoginForm } from '#/components/login-form'
import { getAuthSession } from '#/server/auth.server'
import { JoinView } from './view'

export const metadata: Metadata = { title: 'Join a group · Settlr', robots: { index: false } }

type Props = { params: Promise<{ token: string }> }

// Where a group's invite link leads. Signed out: sign in first, then come
// back here. Signed in: pick who you are in the group and join.
export default async function JoinPage({ params }: Props) {
  const { token } = await params
  const { user } = await getAuthSession()
  if (!user) {
    return (
      <div className="mx-auto grid max-w-md gap-5 py-6">
        <p className="text-center text-sm text-muted-foreground">
          You’ve been invited to a group on Settlr. Sign in to join it.
        </p>
        <LoginForm next={`/join/${token}`} />
      </div>
    )
  }
  return <JoinView token={token} />
}
