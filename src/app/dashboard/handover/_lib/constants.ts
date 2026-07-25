// Hằng số dùng chung cho module Luân chuyển hồ sơ vật lý
// (status, label tiếng Việt, palette badge đồng bộ globals.css)

import type { LucideIcon } from "lucide-react";
import { FileText, Send, Eye, Undo2, CheckCircle2 } from "lucide-react";

// --- Status hồ sơ ---------------------------------------------------------

export type DocumentStatus =
  | "DRAFT"
  | "PENDING_RECEIPT"
  | "IN_REVIEW"
  | "RETURNED"
  | "COMPLETED";

interface StatusMeta {
  label: string;
  // Class badge tận dụng status-*-bg đã định nghĩa trong globals.css
  badgeClass: string;
  icon: LucideIcon;
}

export const DOCUMENT_STATUS_META: Record<DocumentStatus, StatusMeta> = {
  DRAFT: {
    label: "Nháp",
    badgeClass: "status-neutral-bg",
    icon: FileText,
  },
  PENDING_RECEIPT: {
    label: "Chờ nhận",
    badgeClass: "status-warning-bg",
    icon: Send,
  },
  IN_REVIEW: {
    label: "Đang xử lý",
    badgeClass: "status-info-bg",
    icon: Eye,
  },
  RETURNED: {
    label: "Đã trả về",
    badgeClass: "status-danger-bg",
    icon: Undo2,
  },
  COMPLETED: {
    label: "Hoàn thành",
    badgeClass: "status-success-bg",
    icon: CheckCircle2,
  },
};

// --- Status handover -----------------------------------------------------

export type HandoverStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export const HANDOVER_STATUS_LABEL: Record<HandoverStatus, string> = {
  PENDING: "Chờ nhận",
  ACCEPTED: "Đã nhận",
  REJECTED: "Đã từ chối",
};

// --- Tab dashboard ------------------------------------------------------

export type DeskTab = "inbox" | "outbox" | "all";

export const DESK_TAB_LABEL: Record<DeskTab, string> = {
  inbox: "Đang giữ",
  outbox: "Đã chuyển",
  all: "Toàn chi nhánh",
};

// --- Cấu hình upload ảnh ------------------------------------------------

export const MAX_IMAGES_PER_DOCUMENT = 10;
export const IMAGE_COMPRESSION_OPTS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

// --- Cấu hình SLA ------------------------------------------------------

// Ngưỡng % SLA dùng để chuyển màu badge.
export const SLA_WARN_THRESHOLD = 0.7;   // 70% — chuyển sang amber
export const SLA_DANGER_THRESHOLD = 1.0; // 100% — chuyển sang red pulse
