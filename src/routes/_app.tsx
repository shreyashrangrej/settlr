import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { AppTabs } from '#/components/app-nav'

// Pathless layout for the signed-in area (/dashboard, /friends, /groups,
// /personal, /budget, ...). Everything in it is private, so signed-out
// visitors are sent to the home page, where the sign-in form is.
export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) throw redirect({ to: '/' })
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <>
      <AppTabs className="mb-4 md:hidden" />
      <Outlet />
    </>
  )
}
