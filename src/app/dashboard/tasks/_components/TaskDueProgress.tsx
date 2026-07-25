'use client';

// TaskDueProgress — thanh tiến độ % thời gian CÒN LẠI tới deadline.
// Màu: > 50% xanh, 1-50% vàng, <= 0% đỏ (quá hạn).
// Không render khi task done/canceled hoặc không có due_date.

import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface Props {
  createdAt: string;
  dueDate: string | null;
  status: string;
  className?: string;
}

// Định dạng thời gian (Vietnamese, ngắn gọn).
function formatDuration(absMs: number): string {
  const totalMinutes = Math.floor(absMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days >= 1) {
    return hours > 0 ? `${days} ngày ${hours} giờ` : `${days} ngày`;
  }
  if (hours >= 1) {
    return minutes > 0 ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
  }
  return `${Math.max(minutes, 1)} phút`;
}

export function TaskDueProgress({ createdAt, dueDate, status, className }: Props) {
  if (!dueDate || status === 'done' || status === 'canceled') return null;

  const dueMs = new Date(dueDate).getTime();
  const createdMs = new Date(createdAt).getTime();
  const now = Date.now();

  const totalMs = Math.max(dueMs - createdMs, 1);
  const remainingMs = dueMs - now;
  const percentRemaining = Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));

  const isOverdue = remainingMs <= 0;
  const level: 'safe' | 'warn' | 'danger' =
    isOverdue ? 'danger' : percentRemaining > 50 ? 'safe' : 'warn';

  const indicatorClass =
    level === 'safe' ? 'bg-emerald-500'
    : level === 'warn' ? 'bg-amber-500'
    : 'bg-red-500';

  const labelClass =
    level === 'safe' ? 'text-emerald-700'
    : level === 'warn' ? 'text-amber-700'
    : 'text-red-700';

  const label = isOverdue
    ? `Quá hạn ${formatDuration(-remainingMs)}`
    : `Còn ${formatDuration(remainingMs)}`;

  return (
    <div className={cn('space-y-1', className)}>
      <div className={cn('flex items-center gap-1 text-xs font-semibold', labelClass)}>
        {isOverdue ? <AlertTriangle className="icon-sm" /> : <Clock className="icon-sm" />}
        <span>{label}</span>
      </div>
      <Progress
        value={isOverdue ? 100 : percentRemaining}
        className="h-1.5 bg-slate-100"
        indicatorClassName={indicatorClass}
      />
    </div>
  );
}
