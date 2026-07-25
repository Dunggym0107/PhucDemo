'use client';

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { notifyError, notifySuccess } from '@/lib/notify';
import { approveTask } from '../_lib/taskActions';

interface Props {
  task: { id: string; title: string };
  onClose: () => void;
  onChanged: () => void;
}

// Duyệt kết quả (submitted → done). Nhận xét tuỳ chọn — nếu nhập sẽ vào timeline.
export function TaskApproveDialog({ task, onClose, onChanged }: Props) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    const res = await approveTask(task.id, comment.trim() || undefined);
    setLoading(false);
    if (!res.ok) {
      notifyError(res.error, 'Không duyệt được');
      return;
    }
    notifySuccess('Đã duyệt kết quả', 'Người được giao sẽ nhận thông báo.');
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="app-dialog-sheet shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section">Duyệt kết quả</DialogTitle>
          <DialogDescription className="text-subtitle line-clamp-1">{task.title}</DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 tight-stack">
            <Label className="text-label">Nhận xét (tuỳ chọn)</Label>
            <Textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ghi nhận, lời khen hoặc lưu ý cho người thực hiện..."
              className="rounded-xl bg-slate-50 border-none focus-visible:ring-0"
              autoFocus
            />
            <p className="text-meta italic">
              Bỏ trống nếu không cần ghi chú. Duyệt sẽ chốt công việc ở trạng thái Hoàn thành.
            </p>
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl">
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-xl bg-amber-600 hover:bg-amber-700">
            {loading ? <Loader2 className="icon-sm animate-spin" /> : 'Duyệt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
