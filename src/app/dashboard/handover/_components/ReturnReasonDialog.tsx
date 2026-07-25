"use client";

import React from "react";
import { Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { rejectDocument } from "../_lib/transferActions";

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  handoverId: string;
  documentShortCode: string;
  onSuccess: () => void;
}

export default function ReturnReasonDialog({ isOpen, setIsOpen, handoverId, documentShortCode, onSuccess }: Props) {
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) setReason("");
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      notifyValidation("Vui lòng nhập lý do trả về");
      return;
    }
    setSubmitting(true);
    const res = await rejectDocument(handoverId, reason.trim());
    setSubmitting(false);
    if (!res.ok) {
      notifyError(res.error, "Không trả về được hồ sơ");
      return;
    }
    notifySuccess("Đã trả về hồ sơ", "Hồ sơ quay về bàn người gửi kèm lý do.");
    onSuccess();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--lg shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="text-lg font-semibold text-slate-900">Trả về hồ sơ</DialogTitle>
          <DialogDescription className="text-subtitle truncate">
            {documentShortCode} — Hồ sơ sẽ quay lại bàn người gửi với lý do bạn nhập bên dưới.
          </DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="item-stack px-[var(--app-page-x)] py-4">
            <Label className="text-label">Lý do trả về</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Thiếu chữ ký Giám đốc, cần bổ sung CCCD photo..."
              rows={4}
              className="bg-slate-50 border-none rounded-xl font-medium resize-none p-3 min-h-[120px]"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="min-h-11 px-4 rounded-xl font-medium text-slate-500 text-sm"
          >
            Huỷ
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="min-h-11 px-5 rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white"
          >
            <Undo2 className="w-4 h-4 mr-1" /> {submitting ? "Đang trả..." : "Trả về"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
