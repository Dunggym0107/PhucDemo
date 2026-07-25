'use client';

import React from 'react';
import { Building2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeptStat } from '../../_hooks/useTaskAnalytics';

interface Props {
  data: DeptStat[];
}

export function OverdueByDeptChart({ data }: Props) {
  if (!data || data.length === 0) {
    return <p className="text-meta italic">Chưa có dữ liệu phòng ban.</p>;
  }
  const max = Math.max(...data.map(d => d.active), 1);

  return (
    <div className="item-stack">
      {data.map(d => (
        <div key={d.dept_id} className="item-stack">
          <div className="flex items-center gap-2 text-subtitle font-medium">
            <Building2 className="icon-sm text-slate-500" />
            <span className="flex-1 truncate text-slate-700">{d.dept_name}</span>
            <span className="text-meta tabular-nums">{d.active}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full',
                d.overdue > 0 ? 'bg-red-400' : 'bg-primary',
              )}
              style={{ width: `${(d.active / max) * 100}%` }}
            />
          </div>
          {d.overdue > 0 && (
            <div className="flex items-center gap-1 text-red-600 text-meta font-medium">
              <AlertTriangle className="icon-sm" />
              <span>{d.overdue} đang quá hạn</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
