'use client'

import { useEffect } from 'react'

// Radix UI Dialog đôi khi kẹt pointer-events: none trên body
// khi đóng 2 dialog cùng lúc (ví dụ confirm dialog + detail dialog).
// Component này cleanup mỗi khi user click hoặc scroll.
export function PointerEventsCleanup() {
  useEffect(() => {
    const cleanup = () => {
      // Nếu Radix UI quên xoá pointer-events và không có dialog overlay nào,
      // thì tự xoá để page không bị đơ.
      if (document.body.style.pointerEvents === 'none') {
        const hasOpenDialog = document.querySelector('[data-state="open"][role="dialog"]')
        if (!hasOpenDialog) {
          document.body.style.pointerEvents = ''
        }
      }
    }

    document.addEventListener('click', cleanup, true)
    document.addEventListener('transitionend', cleanup, true)
    return () => {
      document.removeEventListener('click', cleanup, true)
      document.removeEventListener('transitionend', cleanup, true)
    }
  }, [])

  return null
}
