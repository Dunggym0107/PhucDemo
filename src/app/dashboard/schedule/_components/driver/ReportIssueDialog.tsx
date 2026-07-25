'use client'

import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  issueText: string;
  setIssueText: (v: string) => void;
  updating: boolean;
  onConfirm: () => void;
}

export default function ReportIssueDialog({ isOpen, setIsOpen, issueText, setIssueText, updating, onConfirm }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="rounded-2xl max-w-sm border-none p-6 shadow-2xl">
        <DialogHeader>
          <DialogDescription className="sr-only">Mô tả sự cố phương tiện phát sinh để gửi thông báo bảo trì.</DialogDescription>
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
            <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            Báo cáo sự cố xe
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <p className="text-label font-semibold text-slate-600">Mô tả chi tiết sự cố</p>
            <Textarea
              placeholder="Ví dụ: Thủng lốp, hỏng điều hòa, động cơ báo lỗi..."
              value={issueText}
              onChange={(e) => setIssueText(e.target.value)}
              className="bg-slate-50 border-none rounded-xl font-medium text-sm focus-visible:ring-1 focus-visible:ring-red-500/30 p-4 min-h-[100px] placeholder:text-slate-500"
            />
          </div>
        </div>
        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl font-semibold text-slate-500 min-h-11 px-5 active:scale-95 transition-all text-sm hover:bg-slate-100">
            Hủy
          </Button>
          <Button onClick={onConfirm} disabled={updating || !issueText.trim()} className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold px-6 min-h-11 active:scale-95 transition-all text-sm shadow-sm">
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gửi báo cáo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
