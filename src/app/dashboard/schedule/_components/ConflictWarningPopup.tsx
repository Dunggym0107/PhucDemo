'use client'

import React from 'react';
import { AlertTriangle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

interface ConflictWarningPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  conflicts: string[];
  title?: string;
}

export default function ConflictWarningPopup({
  isOpen,
  onClose,
  onConfirm,
  conflicts,
  title = 'Cảnh báo trùng lịch',
}: ConflictWarningPopupProps) {
  const hasDeputyWarning = conflicts.some(c =>
    c.toLowerCase().includes('phó giám đốc') || c.toLowerCase().includes('tối đa 2')
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--md shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-slate-900">
            {hasDeputyWarning ? (
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-3 item-stack">
            <p className="text-sm text-slate-600">
              {hasDeputyWarning
                ? 'Lịch trình có thể vi phạm quy định về số lượng Phó giám đốc đi công tác:'
                : 'Có người tham gia bị trùng lịch trong khung giờ này:'}
            </p>

            <div className="bg-red-50/50 rounded-xl border border-red-100 p-3 space-y-2">
              {conflicts.map((c, i) => {
                const isDeputyWarning = c.toLowerCase().includes('phó giám đốc') || c.toLowerCase().includes('tối đa 2');
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 text-sm ${
                      isDeputyWarning ? 'text-amber-700' : 'text-red-700'
                    }`}
                  >
                    <XCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                      isDeputyWarning ? 'text-amber-500' : 'text-red-500'
                    }`} />
                    <span className="leading-relaxed">{c}</span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-500">
              Bạn có muốn tiếp tục đăng ký lịch này không?
            </p>
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg text-xs text-slate-500 bg-slate-100 hover:bg-slate-200"
            onClick={onClose}
          >
            Quay lại
          </Button>
          <Button
            onClick={onConfirm}
            size="sm"
            variant="outline"
            className={`rounded-lg text-xs shadow-sm ${
              hasDeputyWarning
                ? 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
                : 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
            }`}
          >
            Vẫn tiếp tục
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
