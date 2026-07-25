'use client';

import React from 'react';
import { FileText, AlertTriangle, Calendar, Users, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  STATUS_LABEL,
  STATUS_BADGE_CLASS,
  PRIORITY_LABEL,
  PRIORITY_BADGE_CLASS,
} from '../_lib/constants';
import { batchProgress } from '../_lib/batchHelpers';
import type { TaskListItem } from '../_lib/types';
import { TaskDueProgress } from './TaskDueProgress';

interface Props {
  representative: TaskListItem;
  children: TaskListItem[];
  onOpen: () => void;
  currentProfile?: { id: string; role: string; department_id: string | null } | null;
}

const BADGE_BASE = 'px-2.5 py-1 rounded-full text-[12px] font-semibold';

export const TaskCard = React.memo(function TaskCard({ representative, children, onOpen, currentProfile }: Props) {
  const p = batchProgress(children);
  const multi = children.length > 1;
  const dueLabel = representative.due_date
    ? format(new Date(representative.due_date), 'dd/MM', { locale: vi })
    : null;

  // People string: same dept → names, different dept → dept names
  const uniqueDepts = multi ? [...new Set(children.map(c => c.department?.name).filter(Boolean))] : [];
  const batchAllSameDept = uniqueDepts.length === 1;
  const totalPeople = multi ? children.length : (representative.assignees?.length ?? 0);
  const sameDept = representative.department?.id === currentProfile?.department_id;
  const rawNames = multi
    ? (batchAllSameDept
        ? children.flatMap(c => c.assignees?.map((a: any) => a.full_name).filter(Boolean) ?? []).join(', ')
        : uniqueDepts.join(', '))
    : representative.assignees?.map(a => a.full_name).filter(Boolean).join(', ') || '';
  const peopleLabel = multi
    ? (batchAllSameDept
        ? (totalPeople > 3 ? `${totalPeople} người` : rawNames || representative.department?.name || '—')
        : (uniqueDepts.length > 3 ? `${uniqueDepts.length} phòng` : rawNames))
    : sameDept
      ? rawNames || representative.department?.name || '—'
      : (rawNames ? `${rawNames} · ${representative.department?.name ?? ''}` : representative.department?.name || '—');

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-slate-300 hover:shadow-md active:scale-[0.99] transition-all"
    >
      <div className="p-4 space-y-3">
        {/* Hàng 1: Icon + Title + Badge — layout y hệt */}
        <div className="flex items-start gap-2">
          <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-slate-900 leading-snug flex-1 line-clamp-2">
            {representative.title}
          </p>
          {multi ? (
            <Badge variant="outline" className={cn(BADGE_BASE, 'bg-slate-50 border-slate-200 text-slate-600 shrink-0')}>
              <Users className="w-3.5 h-3.5 mr-1 inline-block" />
              {children.length}
            </Badge>
          ) : (
            <Badge variant="outline" className={cn(BADGE_BASE, 'shrink-0', STATUS_BADGE_CLASS[representative.status])}>
              {STATUS_LABEL[representative.status]}
            </Badge>
          )}
        </div>

        {/* Hàng 2: Progress bar — layout y hệt */}
        {multi ? (
          <SegmentedProgressBar progress={p} />
        ) : (
          <TaskDueProgress
            createdAt={representative.created_at}
            dueDate={representative.due_date}
            status={representative.status}
          />
        )}

        {/* Hàng 3: People — layout y hệt (single: 1 dòng, batch: N dòng) */}
        <div className="flex items-center gap-1.5 text-[13px] text-slate-600">
          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{peopleLabel}</span>
        </div>

        {/* Hàng 4: Badges — layout y hệt */}
        <div className="flex flex-wrap items-center gap-1.5">
          {p.overdue > 0 && (
            <span className={cn(BADGE_BASE, 'bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-1')}>
              <AlertTriangle className="w-3 h-3" />
              {p.overdue} quá hạn
            </span>
          )}
          {!multi && representative.priority !== 'medium' && (
            <span className={cn(BADGE_BASE, 'inline-flex items-center gap-1', PRIORITY_BADGE_CLASS[representative.priority])}>
              {PRIORITY_LABEL[representative.priority]}
            </span>
          )}
          {multi && representative.priority !== 'medium' && (
            <span className={cn(BADGE_BASE, 'inline-flex items-center gap-1', PRIORITY_BADGE_CLASS[representative.priority])}>
              {PRIORITY_LABEL[representative.priority]}
            </span>
          )}
          {dueLabel && (
            <span className={cn(BADGE_BASE, 'bg-white border-slate-200 text-slate-600 inline-flex items-center gap-1')}>
              <Calendar className="w-3 h-3" />
              {dueLabel}
            </span>
          )}
        </div>

        {/* Hàng 5: Creator + Department — layout y hệt */}
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-slate-500 truncate">
            {representative.creator?.full_name ?? '—'} giao
          </span>
          <span className="text-slate-400 truncate flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {multi
              ? batchAllSameDept
                ? (representative.department?.name ?? '—')
                : `${uniqueDepts.length} phòng`
              : (representative.department?.name ?? '—')}
          </span>
        </div>
      </div>
    </button>
  );
});

function SegmentedProgressBar({ progress }: { progress: ReturnType<typeof batchProgress> }) {
  const { total, done, submitted, doing } = progress;
  const seg = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  if (total === 0) return null;
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
      {done > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${seg(done)}%` }} />}
      {submitted > 0 && <div className="bg-blue-400 transition-all" style={{ width: `${seg(submitted)}%` }} />}
      {doing > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${seg(doing)}%` }} />}
    </div>
  );
}
