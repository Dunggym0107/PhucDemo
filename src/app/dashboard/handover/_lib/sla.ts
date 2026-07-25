// Tính toán SLA: thời điểm nhận → so với deadline (received_at + sla_hours)

import {
  SLA_DANGER_THRESHOLD,
  SLA_WARN_THRESHOLD,
} from "./constants";
import type { DocumentRow, HandoverRow } from "./types";

export type SlaLevel = "safe" | "warn" | "danger";

interface SlaStatus {
  level: SlaLevel;
  // % SLA đã dùng (0 = vừa nhận, 1 = đúng deadline, >1 = quá hạn)
  usedPercent: number;
  // Số giờ còn lại (âm = đã quá hạn)
  remainingHours: number;
}

// Tìm handover ACCEPTED gần nhất → mốc bắt đầu tính SLA
function findLastAcceptedAt(doc: DocumentRow): string | null {
  const accepted = (doc.handovers || []).filter((h: HandoverRow) => h.status === "ACCEPTED");
  if (accepted.length === 0) return null;
  // Lấy received_at lớn nhất
  return accepted.reduce((max, h) => {
    if (!h.received_at) return max;
    return !max || new Date(h.received_at) > new Date(max) ? h.received_at : max;
  }, null as string | null);
}

export function calcDocumentSla(doc: DocumentRow): SlaStatus | null {
  // Không tính SLA cho hồ sơ chưa được ai nhận hoặc đã hoàn thành/trả về
  if (doc.status !== "IN_REVIEW" && doc.status !== "PENDING_RECEIPT") return null;

  const slaHours = doc.category?.sla_hours;
  if (!slaHours || slaHours <= 0) return null;

  // Mốc bắt đầu: nếu đã có người nhận → received_at lớn nhất; nếu chưa → created_at
  let startedAt: string | null = findLastAcceptedAt(doc);
  if (!startedAt) startedAt = doc.created_at;

  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  const usedPercent = elapsedHours / slaHours;
  const remainingHours = slaHours - elapsedHours;

  let level: SlaLevel = "safe";
  if (usedPercent >= SLA_DANGER_THRESHOLD) level = "danger";
  else if (usedPercent >= SLA_WARN_THRESHOLD) level = "warn";

  return { level, usedPercent, remainingHours };
}

// Format ngắn gọn thời gian còn lại / quá hạn để hiển thị trên badge
export function formatSlaRemaining(remainingHours: number): string {
  const abs = Math.abs(remainingHours);
  if (abs < 1) return `${Math.round(abs * 60)} phút`;
  if (abs < 24) return `${abs.toFixed(1).replace(/\.0$/, "")} giờ`;
  return `${Math.round(abs / 24)} ngày`;
}
