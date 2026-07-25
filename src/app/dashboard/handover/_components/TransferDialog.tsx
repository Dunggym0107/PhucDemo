"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { transferDocument } from "../_lib/transferActions";
import { PeoplePicker } from "@/components/ui/people-picker";
import type { DocumentRow } from "../_lib/types";

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  document: DocumentRow;
  allProfiles: any[];
  currentProfile: any;
  onSuccess: () => void;
}

export default function TransferDialog({
  isOpen, setIsOpen, document, allProfiles, currentProfile, onSuccess,
}: Props) {
  const [receiverId, setReceiverId] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setReceiverId(null);
      setNote("");
    }
  }, [isOpen]);

  // Loại tài xế (không tham gia luồng giấy), admin (quản trị hệ thống, không
  // nhận hồ sơ chi nhánh) và chính mình
  const candidates = React.useMemo(() => {
    return allProfiles.filter(
      (p) => p.id !== currentProfile?.id && p.role !== "driver" && p.role !== "admin",
    );
  }, [allProfiles, currentProfile?.id]);

  const handleSubmit = async () => {
    if (!receiverId) {
      notifyValidation("Vui lòng chọn người nhận");
      return;
    }
    setSubmitting(true);
    const res = await transferDocument(document.id, receiverId, note.trim() || null);
    setSubmitting(false);
    if (!res.ok) {
      notifyError(res.error, "Không chuyển được hồ sơ");
      return;
    }
    notifySuccess("Đã chuyển hồ sơ", "Đợi người nhận xác nhận \"Đã nhận\".");
    onSuccess();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--lg shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section">Chuyển hồ sơ</DialogTitle>
          <DialogDescription className="text-subtitle truncate">
            {document.short_code} — {document.title}
          </DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 group-stack">
            <PeoplePicker
              profiles={candidates}
              selected={receiverId ? [receiverId] : []}
              onChange={(ids) => setReceiverId(ids[0] ?? null)}
              mode="single"
              myDepartmentId={currentProfile?.department_id ?? null}
              myDepartmentName={currentProfile?.departments?.name ?? null}
              defaultOpenGroup="bgd"
            />

            {receiverId && (
              <div className="tight-stack">
                <Label className="text-label">Ghi chú (tuỳ chọn)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Hướng dẫn xử lý, lưu ý cho người nhận..."
                  rows={2}
                  className="bg-slate-50 border-none rounded-xl font-medium resize-none p-3"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-between items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            disabled={submitting}
            className="min-h-11 px-4 rounded-xl font-medium text-slate-500"
          >
            Huỷ
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!receiverId || submitting}
            className="min-h-11 px-5 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-white"
          >
            {submitting ? "Đang chuyển..." : <>Chuyển <ArrowRight className="icon-sm ml-1" /></>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
