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
import { updateTaskStatus, addComment } from '../_lib/taskActions';

interface Props {
  task: { id: string; title: string };
  onClose: () => void;
  onChanged: () => void;
}

export function TaskSubmitResultDialog({ task, onClose, onChanged }: Props) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    if (note.trim()) {
      const cm = await addComment(task.id, `[Gửi kết quả] ${note.trim()}`);
      if (!cm.ok) {
        setLoading(false);
        notifyError(cm.error, 'Không lưu được ghi chú');
        return;
      }
    }
    const res = await updateTaskStatus(task.id, 'submitted');
    setLoading(false);
    if (!res.ok) {
      notifyError(res.error, 'Không nộp được');
      return;
    }
    notifySuccess('Đã gửi kết quả', 'Trưởng phòng sẽ duyệt kết quả.');
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--lg shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section">Gửi kết quả</DialogTitle>
          <DialogDescription className="text-subtitle line-clamp-1">{task.title}</DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 group-stack">
            <div className="tight-stack">
              <Label className="text-label">Ghi chú khi nộp (tuỳ chọn)</Label>
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Đã hoàn tất theo yêu cầu, lưu ý mục..."
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
            {loading ? <Loader2 className="icon-sm animate-spin" /> : 'Gửi kết quả'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
