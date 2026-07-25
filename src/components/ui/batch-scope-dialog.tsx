'use client'

// Hộp thoại chọn phạm vi áp dụng cho thao tác trên task batch.
// 3 nút: Áp cho cả lô (N) | Chỉ task này | Huỷ.
//
// Cách dùng:
//   import { batchScopeDialog } from '@/components/ui/batch-scope-dialog'
//   const scope = await batchScopeDialog({
//     title: 'Sửa cả lô?', description: '...', batchSize: 5, destructive: false,
//   });
//   if (scope === null) return;       // user huỷ
//   if (scope === 'batch') { ... }    // loop qua toàn lô
//   else { ... }                      // chỉ task hiện tại

import React from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

export type BatchScope = 'batch' | 'single' | null

type Options = {
  title: string
  description?: string
  batchSize: number
  batchLabel?: string   // mặc định "lô"
  destructive?: boolean // true → nút "Cả lô" tô đỏ (huỷ/xoá)
}

type InternalState = Options & { open: boolean }

const DEFAULT_STATE: InternalState = {
  open: false,
  title: '',
  description: '',
  batchSize: 0,
  batchLabel: 'lô',
  destructive: false,
}

let setStateRef: React.Dispatch<React.SetStateAction<InternalState>> | null = null
let resolveRef: ((value: BatchScope) => void) | null = null

export function batchScopeDialog(options: Options): Promise<BatchScope> {
  return new Promise<BatchScope>((resolve) => {
    if (!setStateRef) {
      // Fallback an toàn — chỉ trả về single (an toàn nhất)
      resolve('single')
      return
    }
    resolveRef = resolve
    setStateRef({ ...DEFAULT_STATE, ...options, open: true })
  })
}

export function BatchScopeDialogProvider() {
  const [state, setState] = React.useState<InternalState>(DEFAULT_STATE)

  React.useEffect(() => {
    setStateRef = setState
    return () => { setStateRef = null }
  }, [])

  const handle = (result: BatchScope) => {
    if (resolveRef) {
      resolveRef(result)
      resolveRef = null
    }
    setState((s) => ({ ...s, open: false }))
  }

  return (
    <AlertDialog open={state.open} onOpenChange={(o) => { if (!o) handle(null) }}>
      <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[17px] font-semibold text-slate-900">
            {state.title}
          </AlertDialogTitle>
          {state.description && (
            <AlertDialogDescription className="text-sm font-medium text-slate-500 leading-relaxed">
              {state.description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handle('batch')}
            className={cn(
              'rounded-xl min-h-11 font-semibold px-5 text-white border-none active:scale-95 transition-all',
              state.destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary/90',
            )}
          >
            Áp cho cả {state.batchLabel} ({state.batchSize} {state.batchLabel === 'lô' ? 'phòng' : 'task'})
          </button>
          <button
            type="button"
            onClick={() => handle('single')}
            className="rounded-xl min-h-11 font-medium px-5 bg-slate-100 hover:bg-slate-200 text-slate-900 active:scale-95 transition-all"
          >
            Chỉ task này
          </button>
          <button
            type="button"
            onClick={() => handle(null)}
            className="rounded-xl min-h-11 font-medium px-5 bg-transparent hover:bg-slate-50 text-slate-500 active:scale-95 transition-all"
          >
            Huỷ
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
