'use client';

// TodayTaskList — "Việc cần làm hôm nay".
// Actionable list của tôi: status IN (todo,doing,submitted) AND due_date <= cuối ngày.
// Deep-link sang /dashboard/tasks?id={taskId} (đồng bộ pattern detail-dialog).

import React from 'react';
import Link from 'next/link';
import { ChevronRight, CalendarCheck2, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { TodayTaskItem } from '../_lib/types';

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-500',
  low:    'bg-slate-300',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  todo:      { label: 'Cần làm',  className: 'status-neutral-bg' },
  doing:     { label: 'Đang làm', className: 'status-info-bg' },
  submitted: { label: 'Chờ duyệt', className: 'status-warning-bg' },
};

function formatDue(due: string | null) {
  if (!due) return 'Không hạn';
  const d = new Date(due);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `Hôm nay · ${format(d, 'HH:mm')}`;
  }
  return format(d, 'dd/MM HH:mm', { locale: vi });
}

export default function TodayTaskList({ tasks }: { tasks: TodayTaskItem[] }) {
  return (
    <div className="item-stack">
      <div className="flex items-center justify-between px-2">
        <h3 className="heading-card flex items-center gap-2 truncate whitespace-nowrap">
          <CalendarCheck2 className="icon-md text-primary" /> Việc cần làm hôm nay
        </h3>
        <div className="flex items-center gap-2">
          {tasks.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-2 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              {tasks.length}
            </span>
          )}
          <Button variant="ghost" asChild className="text-sm font-medium text-primary min-h-11 hover:bg-primary/5 rounded-full px-4 truncate whitespace-nowrap">
            <Link href="/dashboard/tasks">Tất cả <ChevronRight className="ml-1 icon-sm" /></Link>
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="premium-card p-4 border-none">
          <EmptyState
            icon={<Inbox className="icon-lg" />}
            title="Hôm nay không có việc cần chốt"
            description="Bạn đã xử lý hết những việc đến hạn. Tận hưởng nhịp làm việc nhẹ nhàng."
            variant="subtle"
          />
        </div>
      ) : (
        <div className="item-stack">
          {tasks.map((t) => {
            const status = STATUS_BADGE[t.status] || STATUS_BADGE.todo;
            return (
              <Link
                key={t.id}
                href={`/dashboard/tasks?id=${t.id}`}
                className="block group"
              >
                <div className="flex items-center gap-3 p-4 transition-all rounded-2xl border border-transparent bg-white hover:bg-slate-50 hover:border-slate-100 hover:shadow-sm min-h-11">
                  <span
                    className={cn(
                      'w-2.5 h-2.5 rounded-full shrink-0',
                      PRIORITY_DOT[t.priority || 'low'],
                      t.is_overdue && 'animate-pulse',
                    )}
                  />
                  <div className="flex-1 min-w-0 tight-stack">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-primary transition-colors">
                        {t.title}
                      </p>
                      <Badge className={cn('px-2 py-0.5 text-xs font-medium border-none rounded-full shrink-0', status.className)}>
                        {status.label}
                      </Badge>
                    </div>
                    <p className={cn(
                      'text-meta',
                      t.is_overdue && 'text-red-600 font-semibold',
                    )}>
                      {t.is_overdue ? 'Quá hạn · ' : ''}{formatDue(t.due_date)}
                    </p>
                  </div>
                  <ChevronRight className="icon-sm text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
