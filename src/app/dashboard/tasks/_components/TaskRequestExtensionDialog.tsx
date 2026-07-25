'use client';

// Dialog xin gia hạn (NV bấm) — chọn ngày mới + lý do.

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { notifyError, notifySuccess, notifyValidation } from '@/lib/notify';
import { requestExtension } from '../_lib/taskActions';

interface Props {
  task: { id: string; title: string; due_date: string | null };
  onClose: () => void;
  onChanged: () => void;
}

export function TaskRequestExtensionDialog({ task, onClose, onChanged }: Props) {
  const [newDate, setNewDate] = useState<Date | undefined>(
    task.due_date ? new Date(new Date(task.due_date).getTime() + 24 * 60 * 60 * 1000) : new Date(),
  );
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);

  const handleSubmit = async () => {
    if (!newDate) {
      notifyValidation('Vui lòng chọn ngày gia hạn');
      return;
    }
    if (task.due_date && newDate <= new Date(task.due_date)) {
      notifyValidation('Ngày gia hạn phải sau hạn cũ');
      return;
    }
    setLoading(true);
    const res = await requestExtension({
      task_id: task.id,
      new_due_date: newDate.toISOString(),
      reason: reason.trim() || undefined,
    });
    setLoading(false);
    if (!res.ok) {
      notifyError(res.error, 'Không gửi được yêu cầu');
      return;
    }
    notifySuccess('Đã gửi yêu cầu gia hạn', 'Trưởng phòng sẽ duyệt sớm.');
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--lg shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="text-lg font-semibold text-slate-900">Xin gia hạn</DialogTitle>
          <DialogDescription className="text-subtitle line-clamp-1">{task.title}</DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="space-y-4 px-[var(--app-page-x)] py-4">
            <div className="space-y-2">
              <p className="text-label">Hạn mới</p>
              <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn(
                    'w-full min-h-11 rounded-xl bg-slate-50 border-none font-bold text-slate-900 justify-start px-4 shadow-sm',
                    !newDate && 'text-muted-foreground',
                  )}>
                    <Calendar className="icon-sm mr-2 text-primary" />
                    {newDate ? format(newDate, 'dd/MM/yyyy', { locale: vi }) : 'Chọn ngày'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 rounded-2xl border-none shadow-2xl z-[9999] pointer-events-auto"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <CalendarPicker
                    mode="single"
                    selected={newDate}
                    onSelect={(d) => { setNewDate(d); setIsDateOpen(false); }}
                    initialFocus
                    locale={vi}
                  />
                </PopoverContent>
              </Popover>
              {task.due_date && (
                <p className="text-meta">
                  Hạn cũ: {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: vi })}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-label">Lý do (khuyến nghị)</p>
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Khách chưa gửi hồ sơ, đang chờ cập nhật…"
                className="rounded-xl bg-slate-50 border-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl">
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-xl bg-primary">
            {loading ? <Loader2 className="icon-sm animate-spin" /> : 'Gửi yêu cầu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
