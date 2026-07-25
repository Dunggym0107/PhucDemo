'use client'

import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  selectedSchedule: any;
  updating: boolean;
  onConfirm: () => void;
}

export default function EndTripDialog({ isOpen, setIsOpen, selectedSchedule, updating, onConfirm }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="rounded-2xl max-w-sm border-none p-6 shadow-2xl">
        <DialogHeader>
          <DialogDescription className="sr-only">Nhập chỉ số kilomet kết thúc để hoàn thành chuyến đi.</DialogDescription>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            Kết thúc chuyến đi
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 px-1">
          <p className="text-sm text-slate-500">
            Bạn có chắc chắn chuyến đi đã hoàn thành? Hệ thống sẽ ghi nhận thời gian thực tế và kết thúc lịch trình này.
          </p>
        </div>
        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl font-semibold text-slate-500 min-h-11 px-5 active:scale-95 transition-all text-sm hover:bg-slate-100">
            Hủy
          </Button>
          <Button onClick={onConfirm} disabled={updating} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold px-6 min-h-11 active:scale-95 transition-all text-sm shadow-sm">
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Hoàn thành chuyến"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
