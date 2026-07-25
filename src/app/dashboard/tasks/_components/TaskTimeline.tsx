'use client';

// TaskTimeline — log thời gian: tạo, gia hạn, comment system "[Hệ thống]…".
// Lấy event từ task + comments + extension_requests, sort theo thời gian.

import React, { useMemo } from 'react';
import { Clock, Plus, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import type { TaskDetail } from '../_lib/types';

interface TimelineEvent {
  time: string;
  icon: React.ReactNode;
  text: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

interface Props {
  task: TaskDetail;
}

export function TaskTimeline({ task }: Props) {
  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];

    list.push({
      time: task.created_at,
      icon: <Plus className="icon-sm" />,
      text: (
        <>
          <strong>{task.creator?.full_name ?? '—'}</strong> đã tạo công việc
        </>
      ),
    });

    for (const ext of task.extension_requests ?? []) {
      list.push({
        time: ext.created_at,
        icon: <Clock className="icon-sm" />,
        tone: ext.status === 'approved' ? 'success' : ext.status === 'rejected' ? 'danger' : 'warning',
        text: (
          <>
            <strong>{ext.requester?.full_name ?? '—'}</strong> xin gia hạn{' '}
            {ext.old_due_date && format(new Date(ext.old_due_date), 'dd/MM', { locale: vi })}
            <ArrowRight className="inline icon-sm mx-1" />
            {format(new Date(ext.new_due_date), 'dd/MM', { locale: vi })}
            {' — '}
            {ext.status === 'approved' && 'đã duyệt'}
            {ext.status === 'rejected' && 'từ chối'}
            {ext.status === 'pending' && 'chờ duyệt'}
          </>
        ),
      });
    }

    const systemPatterns = [
      /đã hoàn thành\.?$/,
      /đã duyệt kết quả\.?$/,
      /trả lại công việc đã hoàn thành\. Lý do:/,
      /trả về công việc để sửa\. Lý do:/,
      /đã cập nhật thông tin công việc\.?$/,
      /đã sửa:/,
      /^Đã hủy công việc/,
      /^Đã hoàn thành\.?$/,
    ];

    for (const c of task.comments ?? []) {
      const isSystem = c.content.startsWith('[Hệ thống]') || 
                       c.content.startsWith('[sys]') ||
                       systemPatterns.some(regex => regex.test(c.content));
      if (isSystem) {
        list.push({
          time: c.created_at,
          icon: <AlertCircle className="icon-sm" />,
          tone: 'neutral',
          text: <span className="italic">{c.content.replace('[Hệ thống]', '').replace('[sys]', '').trim()}</span>,
        });
      }
    }

    return list.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [task]);

  if (events.length === 0) return null;

  return (
    <section className="item-stack">
      <ol className="item-stack pl-1">
        {events.map((ev, i) => (
          <li key={i} className="flex gap-3">
            <div className={
              'shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-white ' +
              (ev.tone === 'success' ? 'bg-emerald-500' :
                ev.tone === 'warning' ? 'bg-amber-500' :
                ev.tone === 'danger' ? 'bg-red-500' :
                'bg-slate-300')
            }>
              {ev.icon}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[13px] text-slate-600 leading-relaxed">{ev.text}</p>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                {format(new Date(ev.time), 'HH:mm dd/MM/yyyy', { locale: vi })}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
