'use client';

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { notifyError, notifySuccess, notifyValidation } from '@/lib/notify';
import { rejectSubmission } from '../_lib/taskActions';

interface Props {
  task: { id: string; title: string };
  onClose: () => void;
  onChanged: () => void;
}

// Trả về sửa lại (submitted → doing). Lý do bắt buộc. Áp dụng cho TP/creator/BGĐ.
// Mở lại done → doing tách sang TaskReopenDialog.
export function TaskReturnDialog({ task, onClose, onChanged }: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      notifyValidation('Vui lòng nhập lý do trả về');
      return;
    }
    setLoading(true);
    const res = await rejectSubmission(task.id, reason.trim());
    setLoading(false);
    if (!res.ok) {
      notifyError(res.error, 'Không trả về được');
      return;
    }
    notifySuccess('Đã trả về sửa', 'Người được giao sẽ nhận thông báo và làm lại.');
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="app-dialog-sheet shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section">Trả về sửa lại</DialogTitle>
          <DialogDescription className="text-subtitle line-clamp-1">{task.title}</DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 tight-stack">
            <Label className="text-label">Lý do trả về (bắt buộc)</Label>
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Số liệu chưa khớp, vui lòng sửa lại phần..."
              className="rounded-xl bg-slate-50 border-none focus-visible:ring-0"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl">
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-xl bg-amber-600 hover:bg-amber-700">
            {loading ? <Loader2 className="icon-sm animate-spin" /> : 'Trả về'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
