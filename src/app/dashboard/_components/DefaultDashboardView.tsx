'use client';

// DefaultDashboardView — view chính cho admin/director/manager/staff.
// Gọi 1 RPC dashboard_summary() qua useDashboardSummary().
// 3 KPI card + grid 12 col (8 today list / 4 pending docs).
import React, { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, ListChecks, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { StatsSkeleton, ListSkeleton } from '@/components/ui/list-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppData } from '@/hooks/use-app-data';
import { useDashboardSummary } from '../_hooks/useDashboardSummary';
import TodayTaskList from './TodayTaskList';
import PendingDocsWidget from './PendingDocsWidget';

const INSPIRATIONAL_QUOTES = [
  'Hôm nay là cơ hội để bạn bứt phá chỉ tiêu kinh doanh.',
  'Kiên trì nỗ lực, gặt hái kết quả xứng tầm.',
  'Làm việc chuyên nghiệp, kiến tạo giá trị bền vững.',
  'Mỗi con số đều minh chứng cho sự nỗ lực không ngừng.',
  'Chinh phục kế hoạch, khẳng định vị thế cán bộ.',
  'Năng lượng mới cho những thành công mới hôm nay.',
  'Tập trung tối đa để mang lại giá trị tốt nhất cho khách hàng.',
];

export default function DefaultDashboardView({ profile }: { profile: any }) {
  const { loading, data } = useDashboardSummary();
  const { profiles } = useAppData();
  // today_leaves đã được gộp vào RPC dashboard_summary() — không cần fetch riêng.

  // Quote ổn định theo session — không re-roll khi component re-render do realtime.
  const quote = useMemo(
    () => INSPIRATIONAL_QUOTES[Math.floor(Math.random() * INSPIRATIONAL_QUOTES.length)],
    [],
  );

  const firstName = profile?.full_name?.split(' ').pop() ?? '';

  if (loading) {
    return (
      <div className="page-container section-stack pt-4">
        <header className="flex flex-col gap-4 pt-4 sm:pt-0 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="heading-page">Xin chào, {firstName}!</h1>
            <div className="flex items-center gap-2">
              <Sparkles className="icon-sm text-amber-400" />
              <p className="text-subtitle italic">{quote}</p>
            </div>
          </div>
        </header>
        
        {/* KPI Card Loading Skeleton */}
        <div className="premium-card p-4 sm:p-5">
          <div className="grid grid-cols-3 divide-x divide-slate-100">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center justify-center text-center px-2 py-1 space-y-2.5">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-3 w-14 rounded" />
                <Skeleton className="h-6 w-8 rounded" />
              </div>
            ))}
          </div>
        </div>

        <ListSkeleton variant="card" rows={4} />
      </div>
    );
  }

  const { counts, today_tasks, pending_docs, today_leaves } = data;
  const hasOverdue = counts.overdue > 0;

  return (
    <div className="page-container section-stack motion-safe:animate-fade-in-up">
      <header className="flex flex-col gap-4 pt-4 sm:pt-0 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="heading-page">Xin chào, {firstName}!</h1>
          <div className="flex items-center gap-2">
            <Sparkles className="icon-sm text-amber-400 animate-float" />
            <p className="text-subtitle italic">{quote}</p>
          </div>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground min-h-11 px-5 rounded-2xl font-medium text-sm shadow-primary-glow active:scale-95 transition-all">
          <Link href="/dashboard/tasks">
            Bắt đầu công việc <ArrowRight className="ml-2 icon-sm" />
          </Link>
        </Button>
      </header>

      {/* KPI Card duy nhất dồn 3 thông số */}
      <div className="premium-card p-4 sm:p-5">
        <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
          {/* Cột 1: Đang xử lý */}
          <Link
            href="/dashboard/tasks?status=todo"
            className="flex flex-col items-center justify-center text-center px-1 sm:px-2 py-1 group hover:bg-slate-50/60 rounded-xl transition-all select-none"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2.5 transition-transform group-hover:scale-110">
              <ListChecks className="w-4.5 h-4.5" />
            </div>
            <span className="text-meta">Đang xử lý</span>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <span className="text-lg sm:text-xl font-bold tabular-nums text-slate-900 leading-tight">
                {counts.active}
              </span>
              {counts.urgent > 0 && (
                <Badge className="bg-rose-50 hover:status-danger-bg rounded-full px-1.5 py-0 text-xs font-bold shadow-sm shrink-0">
                  {counts.urgent} khẩn
                </Badge>
              )}
            </div>
          </Link>

          {/* Cột 2: Quá hạn */}
          <Link
            href="/dashboard/tasks?status=overdue"
            className="flex flex-col items-center justify-center text-center px-1 sm:px-2 py-1 group hover:bg-slate-50/60 rounded-xl transition-all select-none"
          >
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 transition-transform group-hover:scale-110",
              hasOverdue ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"
            )}>
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
            <span className={cn("text-meta", hasOverdue && "text-rose-600")}>
              Quá hạn
            </span>
            <span className={cn(
              "text-lg sm:text-xl font-bold tabular-nums leading-tight",
              hasOverdue ? "text-rose-600" : "text-slate-900"
            )}>
              {counts.overdue}
            </span>
          </Link>

          {/* Cột 3: Xong hôm nay */}
          <div className="flex flex-col items-center justify-center text-center px-1 sm:px-2 py-1 select-none">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 mb-2.5">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
            <span className="text-meta">Xong hôm nay</span>
            <span className="text-lg sm:text-xl font-bold tabular-nums text-slate-900 leading-tight">
              {counts.done_today}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: today list (8) + pending docs (4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <TodayTaskList tasks={today_tasks} />
        </div>
        <div className="lg:col-span-4">
          <PendingDocsWidget docs={pending_docs} currentUserId={profile?.id ?? null} />
        </div>
      </div>

      
    </div>
  );
}
