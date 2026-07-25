"use client";

import React from "react";
import { FileText, ArrowRight, User } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { viLocale as vi } from "@/lib/locale";
import { DOCUMENT_STATUS_META } from "../_lib/constants";
import type { DocumentRow } from "../_lib/types";
import SLABadge from "./SLABadge";

interface Props {
  document: DocumentRow;
  onClick: () => void;
  // Inbox card hiển thị nút khác Outbox/All — pass variant để tô đậm phần phù hợp
  variant?: "inbox" | "outbox" | "all";
  currentProfileId?: string | null;
}

export default function DocumentCard({ document, onClick, variant = "inbox", currentProfileId }: Props) {
  const statusMeta = DOCUMENT_STATUS_META[document.status];
  const StatusIcon = statusMeta.icon;

  const lastHandover = (document.handovers || [])
    .slice()
    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];

  const isPendingForMe =
    variant === "inbox" &&
    document.status === "PENDING_RECEIPT" &&
    lastHandover?.receiver_id === currentProfileId &&
    lastHandover?.status === "PENDING";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl bg-white border border-slate-100 p-4 shadow-sm transition-all",
        "hover:shadow-md hover:border-slate-200 active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        isPendingForMe && "ring-2 ring-amber-300 border-amber-200"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
              {document.short_code}
            </p>
            <p className="text-sm font-semibold text-slate-900 truncate">
              {document.title}
            </p>
          </div>
        </div>
        <Badge className={cn("shrink-0 font-semibold text-xs whitespace-nowrap", statusMeta.badgeClass)}>
          <StatusIcon className="w-3 h-3 mr-1" />
          {statusMeta.label}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-label">
        {document.customer_name && (
          <span className="inline-flex items-center gap-1 truncate">
            <User className="w-3 h-3" />
            {document.customer_name}
          </span>
        )}
        {document.category && (
          <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 ring-1 ring-inset ring-slate-100">
            {document.category.name}
          </span>
        )}
        <SLABadge document={document} />
      </div>

      {/* Dòng vị trí hiện tại — khi PENDING_RECEIPT thì hiển thị người tiếp theo
          đang chờ nhận thay vì current_assignee (vẫn là sender chưa chuyển ownership). */}
      {(document.current_assignee || lastHandover) && (() => {
        const pendingFromCurrent = (document.handovers || []).find(
          (h) => h.status === "PENDING" && h.sender_id === document.current_assignee_id
        );
        const isPendingTransit = document.status === "PENDING_RECEIPT";
        const displayPerson = isPendingTransit && pendingFromCurrent?.receiver
          ? pendingFromCurrent.receiver
          : document.current_assignee;
        const outboxLabel = isPendingTransit ? "Đang chờ nhận:" : "Đang ở bàn:";
        const allLabel    = isPendingTransit ? "Chờ nhận:"     : "Bàn:";

        return (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
            {variant === "outbox" && displayPerson && (
              <>
                <span className="text-slate-500">{outboxLabel}</span>
                <span className="inline-flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={displayPerson.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-slate-100">
                      {displayPerson.full_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-slate-700 truncate">
                    {displayPerson.full_name}
                  </span>
                </span>
              </>
            )}
            {variant === "inbox" && lastHandover?.sender && (
              <>
                <span className="text-slate-500">Từ:</span>
                <span className="inline-flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={lastHandover.sender.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-slate-100">
                      {lastHandover.sender.full_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-slate-700 truncate">
                    {lastHandover.sender.full_name}
                  </span>
                </span>
                <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                <span className="text-slate-500">Tôi</span>
              </>
            )}
            {variant === "all" && displayPerson && (
              <>
                <span className="text-slate-500">{allLabel}</span>
                <span className="inline-flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={displayPerson.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-slate-100">
                      {displayPerson.full_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-slate-700 truncate">
                    {displayPerson.full_name}
                  </span>
                </span>
              </>
            )}
            <span className="ml-auto text-meta tabular-nums shrink-0">
              {format(new Date(document.updated_at), "HH:mm dd/MM", { locale: vi })}
            </span>
          </div>
        );
      })()}
    </button>
  );
}
