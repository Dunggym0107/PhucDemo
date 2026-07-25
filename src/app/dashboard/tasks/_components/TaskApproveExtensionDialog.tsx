'use client';

// Dialog duyệt/từ chối yêu cầu gia hạn (Manager+).

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowRight, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { notifyError, notifySuccess } from '@/lib/notify';
import { decideExtension } from '../_lib/taskActions';

interface ExtensionData {
  id: string;
  reason: string | null;
  old_due_date: string | null;
  new_due_date: string;
  requester: { full_name: string | null } | null;
  task: { title: string } | null;
}

interface Props {
  extension: ExtensionData;
  onClose: () => void;
  onChanged: () => void;
}

export function TaskApproveExtensionDialog({ extension, onClose, onChanged }: Props) {
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDecide = async (approve: boolean) => {
    setLoading(true);
    const res = await decideExtension(extension.id, approve, comment.trim() || undefined);
    setLoading(false);
    if (!res.ok) {
      notifyError(res.error, 'Không xử lý được yêu cầu');
      return;
    }
    notifySuccess(approve ? 'Đã duyệt gia hạn' : 'Đã từ chối gia hạn');
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--lg shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="text-lg font-semibold text-slate-900">Xử lý yêu cầu gia hạn</DialogTitle>
          <DialogDescription className="text-subtitle line-clamp-1">
            {extension.task?.title ?? '—'}
          </DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="space-y-4 px-[var(--app-page-x)] py-4">
            <div className="premium-card p-4 border-none space-y-2 bg-slate-50">
              <p className="text-xs font-medium text-slate-500">Người xin</p>
              <p className="text-sm font-bold text-slate-900">
                {extension.requester?.full_name ?? '—'}
              </p>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-700 pt-2">
                <span>
                  {extension.old_due_date
                    ? format(new Date(extension.old_due_date), 'dd/MM/yyyy', { locale: vi })
                    : '—'}
                </span>
                <ArrowRight className="icon-sm text-primary" />
                <span className="text-primary font-bold">
                  {format(new Date(extension.new_due_date), 'dd/MM/yyyy', { locale: vi })}
                </span>
              </div>
              {extension.reason && (
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs font-medium text-slate-500 mb-1">Lý do</p>
                  <p className="text-xs italic text-slate-700">"{extension.reason}"</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-label">Ghi chú phản hồi (tuỳ chọn)</p>
              <Textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="VD: OK, ưu tiên xử lý sớm…"
                className="rounded-xl bg-slate-50 border-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => handleDecide(false)} disabled={loading} className="rounded-xl">
            <X className="icon-sm mr-1" /> Từ chối
          </Button>
          <Button onClick={() => handleDecide(true)} disabled={loading} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
            {loading ? <Loader2 className="icon-sm animate-spin" /> : (<><Check className="icon-sm mr-1" /> Cho dời</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
