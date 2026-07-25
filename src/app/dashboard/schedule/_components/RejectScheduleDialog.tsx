'use client'

import React from "react";
import { XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RejectScheduleDialogProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  scheduleTitle?: string;
  description?: string;
  onConfirm: (reason: string) => void | Promise<void>;
}

const MIN_LEN = 10;

export default function RejectScheduleDialog({ isOpen, setIsOpen, scheduleTitle, description, onConfirm }: RejectScheduleDialogProps) {
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setReason("");
      setSubmitting(false);
    }
  }, [isOpen]);

  const trimmedLen = reason.trim().length;
  const isValid = trimmedLen >= MIN_LEN;

  const handleConfirm = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setIsOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="rounded-3xl border-none shadow-2xl max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <XCircle className="icon-md text-red-600" />
            <DialogTitle className="text-lg font-semibold text-slate-900">Từ chối lịch trình</DialogTitle>
          </div>
          <DialogDescription className="text-label leading-relaxed">
            {description || (scheduleTitle
              ? <>Nhập lý do từ chối lịch <span className="font-semibold text-slate-700">&ldquo;{scheduleTitle}&rdquo;</span> để người tạo có thể chỉnh sửa và gửi lại.</>
              : 'Nhập lý do từ chối để người tạo có thể chỉnh sửa và gửi lại.')}
          </DialogDescription>
        </DialogHeader>

        <div className="item-stack">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Vd: Trùng giờ với lịch BGĐ, đề nghị đổi sang chiều..."
            rows={4}
            className="resize-none"
            autoFocus
          />
          <p className={cn(
            "text-xs font-medium",
            isValid ? "text-slate-500" : "text-amber-600"
          )}>
            {isValid
              ? `${trimmedLen} ký tự`
              : `Cần thêm ${MIN_LEN - trimmedLen} ký tự (tối thiểu ${MIN_LEN}).`}
          </p>
        </div>

        <DialogFooter className="mt-2 gap-3">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            disabled={submitting}
            className="rounded-xl min-h-11 font-medium"
          >
            Huỷ
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || submitting}
            className="rounded-xl min-h-11 font-medium px-6 bg-red-600 hover:bg-red-700 text-white border-none"
          >
            {submitting ? 'Đang gửi...' : 'Xác nhận từ chối'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
