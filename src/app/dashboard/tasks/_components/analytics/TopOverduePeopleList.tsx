'use client';

import React from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { PersonStat } from '../../_hooks/useTaskAnalytics';

interface Props {
  data: PersonStat[];
}

export function TopOverduePeopleList({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <section className="premium-card p-5 border-none item-stack flex flex-col justify-center items-center text-slate-400">
        <CheckCircle2 className="w-12 h-12 mb-2 text-emerald-400 opacity-50" />
        <p className="font-medium">Không có cán bộ chậm tiến độ</p>
      </section>
    );
  }

  return (
    <section className="premium-card p-5 border-none space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="icon-md text-red-500" />
        <h2 className="heading-card">Cán bộ chậm tiến độ</h2>
      </div>

      <div className="item-stack">
        {data.slice(0, 10).map(item => (
          <Link
            key={item.user_id}
            href={`/dashboard/team/${item.user_id}`}
            className="flex items-center gap-3 group p-2 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <Avatar className="avatar-sm shrink-0">
              <AvatarImage src={item.avatar_url ?? undefined} alt={item.full_name ?? ''} />
              <AvatarFallback className="text-xs">
                {item.full_name?.charAt(0) ?? '?'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex flex-col text-xs font-medium">
                <span className="truncate text-slate-700 group-hover:text-primary transition-colors font-semibold">
                  {item.full_name ?? '—'}
                </span>
                <span className="truncate text-slate-500">
                  {item.department_name ?? '—'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0 text-xs text-slate-500 text-right">
              <div className="flex flex-col">
                <span className="font-semibold text-red-600">{item.overdue} quá hạn</span>
                <span>{item.active} đang xử lý</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
