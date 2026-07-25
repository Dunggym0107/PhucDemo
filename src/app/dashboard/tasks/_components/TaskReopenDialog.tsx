'use client';

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';
import { notifyError, notifySuccess, notifyValidation } from '@/lib/notify';
import { reopenDone } from '../_lib/taskActions';

interface Props {
  task: { id: string; title: string };
  onClose: () => void;
  onChanged: () => void;
}

// Mở lại công việc đã hoàn thành (done → doing). Chỉ người tạo/admin.
// Tách riêng khỏi TaskReturnDialog để cảnh báo rõ "đảo ngược quyết định đã chốt".
export function TaskReopenDialog({ task, onClose, onChanged }: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      notifyValidation('Vui lòng nhập lý do mở lại');
      return;
    }
    setLoading(true);
    const res = await reopenDone(task.id, reason.trim());
    setLoading(false);
    if (!res.ok) {
      notifyError(res.error, 'Không mở lại được');
      return;
    }
    notifySuccess('Đã mở lại công việc', 'Người được giao sẽ nhận thông báo và làm lại.');
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="app-dialog-sheet shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section">Mở lại công việc đã hoàn thành</DialogTitle>
          <DialogDescription className="text-subtitle line-clamp-1">{task.title}</DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 tight-stack">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="icon-sm text-amber-700 shrink-0 mt-0.5" />
              <p className="text-subtitle text-amber-800">
                Công việc đang ở trạng thái <b>Hoàn thành</b>. Mở lại sẽ đưa về <b>Đang làm</b> để
                người được giao sửa, và ghi vào nhật ký truy vết.
              </p>
            </div>

            <Label className="text-label">Lý do mở lại (bắt buộc)</Label>
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Phát hiện sai số liệu sau khi duyệt, cần sửa lại phần..."
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
            {loading ? <Loader2 className="icon-sm animate-spin" /> : 'Mở lại'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
