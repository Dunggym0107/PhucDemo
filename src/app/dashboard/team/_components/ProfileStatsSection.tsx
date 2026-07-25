'use client'

import React, { useMemo } from "react";
import { Briefcase, CheckCircle2, Clock } from "lucide-react";

// Thống kê task tháng hiện tại — đúng nghĩa "tháng này" (không phải tất cả thời gian).
// Input: monthlyTasks đã được useProfileDetail filter sẵn theo gte('created_at', monthStart).
interface ProfileStatsSectionProps {
  monthlyTasks: any[];
}

export default function ProfileStatsSection({ monthlyTasks }: ProfileStatsSectionProps) {
  const stats = useMemo(() => {
    const total = monthlyTasks.length;
    const done = monthlyTasks.filter((t) => t.status === 'completed').length;
    const inProgress = monthlyTasks.filter((t) => t.status === 'in_progress' || t.status === 'pending').length;
    return { total, done, inProgress };
  }, [monthlyTasks]);

  const cards = [
    { icon: Briefcase, label: "Tổng task tháng này", value: stats.total, bg: "bg-primary/10", color: "text-primary" },
    { icon: CheckCircle2, label: "Đã hoàn thành", value: stats.done, bg: "bg-emerald-50", color: "text-emerald-600" },
    { icon: Clock, label: "Đang xử lý", value: stats.inProgress, bg: "bg-amber-50", color: "text-amber-600" },
  ];

  return (
    <section className="grid grid-cols-3 gap-2">
      {cards.map(({ icon: Icon, label, value, bg, color }) => (
        <div key={label} className="rounded-2xl bg-white border border-slate-100 p-3 flex flex-col items-center text-center gap-1 shadow-sm">
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${bg} ${color}`}>
            <Icon className="icon-sm" />
          </span>
          <span className="text-lg font-bold text-slate-900 leading-none">{value}</span>
          <span className="text-xs font-semibold text-slate-500 leading-tight">{label}</span>
        </div>
      ))}
    </section>
  );
}
