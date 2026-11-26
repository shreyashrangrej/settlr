'use client'

import { useConvexMutation } from '@convex-dev/react-query'
import { toast } from 'sonner'

import { errorMessage } from '#/lib/errors'
import { api } from '@settlr/backend/convex/_generated/api'
import type { Id } from '@settlr/backend/convex/_generated/dataModel'

/**
 * Deletes something that goes to the trash, then shows a toast with Undo
 * (which restores it). Resolves to whether the delete worked, for
 * `RowActions`' confirm dialog.
 */
export function useDeleteWithUndo<Args>(
  remove: (args: Args) => Promise<Id<'trash'> | null>,
  label = 'Expense deleted',
) {
  const restore = useConvexMutation(api.trash.restore)
  return async (args: Args) => {
    try {
      const trashId = await remove(args)
      if (trashId) {
        toast.success(label, {
          description: 'It’s in Trash for 30 days.',
          action: {
            label: 'Undo',
            onClick: () => {
              restore({ trashId }).then(
                () => toast.success('Restored'),
                (err: unknown) => toast.error(errorMessage(err)),
              )
            },
          },
        })
      } else {
        toast.success('Deleted')
      }
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }
}

export const UNDO_DESCRIPTION = 'Balances will be updated. You can restore it from Trash for 30 days.'
