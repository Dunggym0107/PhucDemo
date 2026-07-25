'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, FileText, CalendarClock, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnalyticsTotals } from '../../_hooks/useTaskAnalytics';

interface Props {
  totals: AnalyticsTotals;
  recurringActive: number;
}

export function AnalyticsKpiCards({ totals, recurringActive }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard
        icon={<CheckCircle2 className="icon-md" />}
        label="Hoàn thành"
        value={totals.completed}
        tone="success"
      />
      <KpiCard
        icon={<AlertTriangle className="icon-md" />}
        label="Đang quá hạn"
        value={totals.overdue}
        tone="danger"
      />
      <KpiCard
        icon={<FileText className="icon-md" />}
        label="Chờ duyệt"
        value={totals.submitted_pending}
        tone="info"
      />
      <KpiCard
        icon={<Clock className="icon-md" />}
        label="Gia hạn chờ"
        value={totals.extensions_pending}
        tone="warning"
      />
      <KpiCard
        icon={<CalendarClock className="icon-md" />}
        label="Định kỳ đang chạy"
        value={recurringActive}
        tone="neutral"
        className="md:col-span-1 col-span-2"
      />
    </div>
  );
}

type Tone = 'success' | 'danger' | 'info' | 'warning' | 'neutral';

function KpiCard({ icon, label, value, tone, className }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: Tone;
  className?: string;
}) {
  const toneClass: Record<Tone, string> = {
    success: 'status-success-bg',
    danger: 'status-danger-bg',
    info: 'status-info-bg',
    warning: 'status-warning-bg',
    neutral: 'status-neutral-bg',
  };
  return (
    <div className={cn('p-4 rounded-2xl flex items-center gap-3', toneClass[tone], className)}>
      <div className="shrink-0 p-2 bg-white/40 rounded-xl">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-meta font-medium">{label}</p>
        <p className="heading-page tabular-nums">{value}</p>
      </div>
    </div>
  );
}
