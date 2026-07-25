'use client';

import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import {
  Calendar, Edit2, Loader2, Trash2, AlertCircle, Clock, Users, Play,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { notifyError, notifySuccess } from '@/lib/notify';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import {
  deleteRecurringTemplate, toggleRecurringTemplate, forceRunRecurringTemplate,
} from '../_lib/recurringActions';
import {
  formatScheduleHuman,
  type RecurringTemplate,
} from '../_lib/recurringHelpers';

interface Props {
  template: RecurringTemplate;
  onEdit: (t: RecurringTemplate) => void;
  onChanged: () => void;
}

export function RecurringTemplateCard({ template, onEdit, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const handleToggle = async (active: boolean) => {
    setBusy('toggle');
    const res = await toggleRecurringTemplate(template.id, active);
    setBusy(null);
    if (!res.ok) { notifyError(res.error, 'Không đổi trạng thái được'); return; }
    notifySuccess(active ? 'Đã bật' : 'Đã tắt');
    onChanged();
  };

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: 'Xoá lịch định kỳ?',
      description: `"${template.title}" sẽ bị xoá vĩnh viễn. Công việc đã sinh trước đó vẫn còn.`,
      confirmText: 'Xoá', danger: true,
    });
    if (!ok) return;
    setBusy('delete');
    const res = await deleteRecurringTemplate(template.id);
    setBusy(null);
    if (!res.ok) { notifyError(res.error, 'Không xoá được'); return; }
    notifySuccess('Đã xoá mẫu định kỳ');
    onChanged();
  };

  const handleForceRun = async () => {
    const ok = await confirmDialog({
      title: 'Sinh công việc ngay?',
      description: `Bạn có muốn ép hệ thống sinh công việc cho "${template.title}" ngay bây giờ không?`,
      confirmText: 'Chạy ngay',
    });
    if (!ok) return;
    setBusy('force_run');
    const res = await forceRunRecurringTemplate(template.id);
    setBusy(null);
    if (!res.ok) { notifyError(res.error, 'Lỗi sinh công việc'); return; }
    notifySuccess('Đã sinh công việc thành công');
    onChanged();
  };

  const nextRun = template.next_run_at ? new Date(template.next_run_at) : null;
  const totalTargets = template.target_department_ids.length + template.target_user_ids.length;

  return (
    <div className={`bg-white border border-slate-100 rounded-2xl shadow-sm p-4 space-y-3 ${!template.is_active ? 'opacity-60' : ''}`}>
      {/* Hàng 1: Icon + Title + Switch */}
      <div className="flex items-start gap-3">
        <div className="p-2 bg-slate-50 rounded-xl shadow-sm shrink-0">
          <Calendar className={`w-4 h-4 ${template.is_active ? 'text-amber-500' : 'text-slate-500'}`} />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-semibold text-slate-900 truncate">{template.title}</p>
          <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatScheduleHuman(template)}
          </p>
        </div>
        <Switch
          checked={template.is_active}
          onCheckedChange={handleToggle}
          disabled={busy !== null}
        />
      </div>

      {/* Hàng 2: Mô tả */}
      {template.description && (
        <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{template.description}</p>
      )}

      {/* Hàng 3: Badges + next run */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
        <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 inline-flex items-center gap-1">
          Công việc
        </span>
        <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 inline-flex items-center gap-1">
          <Users className="w-3 h-3" />
          {totalTargets > 0
            ? template.target_department_ids.length > 0
              ? `${template.target_department_ids.length} phòng`
              : `${template.target_user_ids.length} cán bộ`
            : 'Chưa có đích'}
        </span>
        {nextRun && template.is_active ? (
          <span className="text-xs font-medium text-slate-500 ml-auto">
            Lần kế: {format(nextRun, "EEEE 'lúc' HH:mm dd/MM", { locale: vi })}
          </span>
        ) : (
          <span className="text-xs font-medium text-slate-400 ml-auto inline-flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Đang tắt
          </span>
        )}
      </div>

      {/* Hàng 4: Actions */}
      <div className="flex gap-1.5 pt-1">
        <button
          onClick={handleForceRun}
          disabled={busy !== null || !template.is_active}
          className="h-9 px-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 gap-1.5 text-sm font-semibold mr-auto"
          title="Chạy ngay"
        >
          {busy === 'force_run' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Chạy ngay
        </button>
        <button
          onClick={() => onEdit(template)}
          disabled={busy !== null}
          className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
          title="Sửa"
        >
          <Edit2 className="w-4 h-4 text-slate-500" />
        </button>
        <button
          onClick={handleDelete}
          disabled={busy !== null}
          className="h-9 w-9 rounded-xl bg-red-50 border border-red-100 hover:bg-red-100 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ml-auto"
          title="Xoá"
        >
          {busy === 'delete' ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : <Trash2 className="w-4 h-4 text-red-500" />}
        </button>
      </div>
    </div>
  );
}
