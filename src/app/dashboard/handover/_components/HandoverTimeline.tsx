"use client";

import React from "react";
import { Send, ArrowRight, Undo2, Clock } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, formatDistanceStrict } from "date-fns";
import { viLocale as vi } from "@/lib/locale";
import type { HandoverRow, DocumentRow } from "../_lib/types";

interface Props {
  document: DocumentRow;
}

// Trục thời gian dọc: mỗi mốc = 1 handover. Hiển thị sender → receiver, sent_at,
// received_at, note (nếu có). Mốc cuối cùng tô đậm.
export default function HandoverTimeline({ document }: Props) {
  const handovers = React.useMemo(() => {
    return [...(document.handovers || [])].sort(
      (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
    );
  }, [document.handovers]);

  if (handovers.length === 0) {
    return (
      <div className="text-meta italic">
        Chưa có lần chuyển nào — hồ sơ vẫn ở bàn của người tạo.
      </div>
    );
  }

  return (
    <ol className="relative ml-3 border-l-2 border-slate-100 space-y-5">
      {/* Mốc khởi tạo */}
      <li className="relative pl-5">
        <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-slate-300 ring-4 ring-white" />
        <p className="text-xs font-semibold text-slate-500">
          {format(new Date(document.created_at), "HH:mm dd/MM/yyyy", { locale: vi })}
        </p>
        <p className="text-sm font-semibold text-slate-700 mt-0.5">
          {document.creator?.full_name || "Người tạo"} khởi tạo hồ sơ
        </p>
      </li>

      {handovers.map((h, idx) => {
        const isLast = idx === handovers.length - 1;
        const dot = h.status === "ACCEPTED"
          ? "bg-emerald-500"
          : h.status === "REJECTED"
            ? "bg-red-500"
            : "bg-amber-500";

        const dwellLabel =
          h.received_at
            ? `Giữ ${formatDistanceStrict(new Date(h.sent_at), new Date(h.received_at), { locale: vi })}`
            : "Đang chờ nhận...";

        return (
          <li key={h.id} className="relative pl-5">
            <span
              className={cn(
                "absolute -left-[7px] top-1.5 w-3 h-3 rounded-full ring-4 ring-white",
                dot,
                isLast && h.status === "PENDING" && "animate-pulse"
              )}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500 tabular-nums">
                {format(new Date(h.sent_at), "HH:mm dd/MM", { locale: vi })}
              </p>
              <Badge
                className={cn(
                  "shrink-0 font-semibold text-xs",
                  h.status === "ACCEPTED" && "status-success-bg",
                  h.status === "REJECTED" && "status-danger-bg",
                  h.status === "PENDING" && "status-warning-bg"
                )}
              >
                {h.status === "ACCEPTED" ? "Đã nhận" : h.status === "REJECTED" ? "Trả về" : "Chờ nhận"}
              </Badge>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
              {h.sender && (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={h.sender.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-slate-100">{h.sender.full_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{h.sender.full_name}</span>
                </span>
              )}
              {h.status === "REJECTED" ? (
                <Undo2 className="w-3 h-3 text-red-500 shrink-0" />
              ) : (
                <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
              )}
              {h.receiver && (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={h.receiver.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-slate-100">{h.receiver.full_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{h.receiver.full_name}</span>
                </span>
              )}
            </div>

            <p className="mt-1 flex items-center gap-1 text-meta">
              <Clock className="w-3 h-3" /> {dwellLabel}
            </p>

            {h.note && (
              <p className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2 whitespace-pre-wrap">
                📝 {h.note}
              </p>
            )}
            {h.status === "REJECTED" && h.reject_reason && (
              <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 whitespace-pre-wrap">
                ↩ Lý do: {h.reject_reason}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
