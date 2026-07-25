'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from './skeleton'

// Skeleton chuẩn cho trang danh sách (List). Dùng thay <Loader2 /> full-page.
// Hiển thị 5 hàng giả định, mỗi hàng có avatar + 2 dòng text + meta.
interface ListSkeletonProps {
  rows?: number
  className?: string
  variant?: 'list' | 'card' | 'table'
}

export function ListSkeleton({ rows = 5, className, variant = 'list' }: ListSkeletonProps) {
  if (variant === 'card') {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="premium-card border-none space-y-4 p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div className={cn('rounded-2xl border border-slate-100 overflow-hidden', className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={cn(
            'flex items-center gap-4 px-6 py-4',
            i !== 0 && 'border-t border-slate-50'
          )}>
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3 rounded" />
              <Skeleton className="h-3 w-2/3 rounded" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('item-stack', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100">
          <Skeleton className="h-11 w-11 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2 rounded" />
            <Skeleton className="h-3 w-2/3 rounded" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  )
}

// Skeleton cho block thông tin (stats card grid)
export function StatsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="premium-card border-none p-6 item-stack">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-3 w-2/3 rounded" />
          <Skeleton className="h-8 w-1/2 rounded" />
        </div>
      ))}
    </div>
  )
}
