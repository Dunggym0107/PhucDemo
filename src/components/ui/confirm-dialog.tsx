'use client'

import React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

// Hộp thoại xác nhận theo Apple HIG, dùng thay thế confirm() native.
// Cách dùng:
//   import { confirmDialog } from '@/components/ui/confirm-dialog'
//   const ok = await confirmDialog({ title: 'Xác nhận xóa', description: '...' , danger: true })

type ConfirmOptions = {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

type InternalState = ConfirmOptions & { open: boolean }

const DEFAULT_STATE: InternalState = {
  open: false,
  title: '',
  description: '',
  confirmText: 'Xác nhận',
  cancelText: 'Hủy',
  danger: false,
}

let setStateRef: React.Dispatch<React.SetStateAction<InternalState>> | null = null
let resolveRef: ((value: boolean) => void) | null = null

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!setStateRef) {
      // Fallback an toàn nếu Provider chưa mount
      const ok = window.confirm(options.description || options.title)
      resolve(ok)
      return
    }
    resolveRef = resolve
    setStateRef({ ...DEFAULT_STATE, ...options, open: true })
  })
}

export function ConfirmDialogProvider() {
  const [state, setState] = React.useState<InternalState>(DEFAULT_STATE)

  React.useEffect(() => {
    setStateRef = setState
    return () => { setStateRef = null }
  }, [])

  const handle = (result: boolean) => {
    if (resolveRef) {
      resolveRef(result)
      resolveRef = null
    }
    setState((s) => ({ ...s, open: false }))
  }

  return (
    <AlertDialog open={state.open} onOpenChange={(o) => { if (!o) handle(false) }}>
      <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[17px] font-semibold text-slate-900">{state.title}</AlertDialogTitle>
          {state.description && (
            <AlertDialogDescription className="text-sm font-medium text-slate-500 leading-relaxed">
              {state.description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4 gap-3">
          <AlertDialogCancel
            onClick={() => handle(false)}
            className="rounded-xl min-h-11 font-medium active:scale-95 transition-all"
          >
            {state.cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handle(true)}
            className={cn(
              'rounded-xl min-h-11 font-medium px-6 text-white border-none active:scale-95 transition-all',
              state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90'
            )}
          >
            {state.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
