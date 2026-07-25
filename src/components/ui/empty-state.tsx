'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

// EmptyState chuẩn theo Apple HIG: icon lớn, tiêu đề ngắn, mô tả thân thiện, hành động chính nếu có.

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  variant?: 'default' | 'subtle' | 'card'
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const container = variant === 'card'
    ? 'premium-card border border-slate-100 bg-white text-center'
    : variant === 'subtle'
      ? 'text-center py-10'
      : 'rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm'

  return (
    <div className={cn(container, className)}>
      <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100/50">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-slate-900 leading-tight">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          className="mt-5 h-11 rounded-xl bg-primary hover:bg-primary/90 text-white px-5 font-medium active:scale-95 transition-all"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
