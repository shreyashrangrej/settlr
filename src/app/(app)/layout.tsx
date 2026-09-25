import { redirect } from 'next/navigation'

import { AppTabs } from '#/components/app-nav'
import { getAuthSession } from '#/server/auth.server'

// The signed-in area (/dashboard, /friends, /groups, /personal, /budget,
// ...). Everything in it is private, so signed-out visitors are sent to the
// home page, where the sign-in form is.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getAuthSession()
  if (!user) redirect('/')
  return (
    <>
      <AppTabs className="mb-4 md:hidden" />
      {children}
    </>
  )
}
