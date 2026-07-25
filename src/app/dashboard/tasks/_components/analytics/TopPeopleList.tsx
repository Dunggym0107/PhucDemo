'use client';

import React from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertTriangle } from 'lucide-react';
import type { PersonStat } from '../../_hooks/useTaskAnalytics';

interface Props {
  data: PersonStat[];
}

export function TopPeopleList({ data }: Props) {
  if (!data || data.length === 0) {
    return <p className="text-meta italic">Chưa có dữ liệu cá nhân.</p>;
  }
  return (
    <ul className="item-stack">
      {data.map(p => (
        <li key={p.user_id}>
          <Link
            href={`/dashboard/team/${p.user_id}`}
            className="flex items-center gap-3 h-12 px-3 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Avatar className="avatar-sm">
              <AvatarImage src={p.avatar_url ?? undefined} />
              <AvatarFallback className="text-meta font-semibold">
                {p.full_name?.[0] ?? '?'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-subtitle font-medium text-slate-900 truncate">{p.full_name ?? '—'}</p>
              <p className="text-meta truncate">{p.department_name ?? '—'}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-subtitle font-bold text-slate-900 tabular-nums">{p.active}</span>
              {p.overdue > 0 && (
                <span className="inline-flex items-center gap-1 text-red-600 text-meta font-semibold">
                  <AlertTriangle className="icon-sm" />
                  {p.overdue}
                </span>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
