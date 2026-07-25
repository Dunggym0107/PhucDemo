'use client'

import React from "react";
import { XCircle, RotateCcw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { viLocale as vi } from "@/lib/locale";
import { Button } from "@/components/ui/button";

interface RejectedBannerProps {
  schedule: any;
  isCreator: boolean;
  onResubmit: () => void;
}

export default function RejectedBanner({ schedule, isCreator, onResubmit }: RejectedBannerProps) {
  if (!schedule || schedule.status !== 'rejected') return null;

  const reason = schedule.rejection_reason || 'Không có lý do được ghi lại (lịch cũ).';
  const rejecter = schedule.rejecter;
  const rejecterName = rejecter?.full_name || 'Người duyệt';
  const rejectedAt = schedule.rejected_at ? new Date(schedule.rejected_at) : null;
  const relativeTime = rejectedAt
    ? formatDistanceToNow(rejectedAt, { addSuffix: true, locale: vi })
    : null;

  return (
    <div className="status-danger-bg border rounded-2xl p-4 item-stack">
      <div className="flex items-start gap-3">
        <XCircle className="icon-md shrink-0 mt-0.5" />
        <div className="flex-1 item-stack">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-slate-900">Đã bị từ chối</h4>
            {relativeTime && (
              <span className="text-meta">{relativeTime}</span>
            )}
          </div>

          <p className="text-sm leading-relaxed">
            <span className="opacity-75">Lý do:</span> {reason}
          </p>

          <p className="text-meta">
            Bởi {rejecterName}{rejecter?.title ? ` · ${rejecter.title}` : ''}
          </p>

          {isCreator && (
            <div className="pt-1">
              <Button
                onClick={onResubmit}
                className="rounded-xl min-h-11 font-medium px-5 bg-red-700 hover:bg-red-800 text-white border-none"
              >
                <RotateCcw className="icon-sm" />
                Sửa &amp; đẩy lại duyệt
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
