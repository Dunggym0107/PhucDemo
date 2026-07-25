"use client";

import React from "react";
import { Clock, AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { calcDocumentSla, formatSlaRemaining } from "../_lib/sla";
import type { DocumentRow } from "../_lib/types";

interface Props {
  document: DocumentRow;
  className?: string;
}

// Chip cảnh báo SLA: emerald (an toàn) / amber (sắp hết) / red pulse (quá hạn)
export default function SLABadge({ document, className }: Props) {
  const [, setTick] = React.useState(0);

  // Re-render mỗi 60s để cập nhật label "5 phút", "1 giờ"...
  React.useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const sla = calcDocumentSla(document);
  if (!sla) return null;

  const isDanger = sla.level === "danger";
  const isWarn = sla.level === "warn";

  const palette = isDanger
    ? "bg-red-50 text-red-700 ring-red-200"
    : isWarn
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-emerald-50 text-emerald-700 ring-emerald-200";

  const Icon = isDanger ? AlertCircle : isWarn ? Clock : Check;
  const text = isDanger
    ? `Quá hạn ${formatSlaRemaining(sla.remainingHours)}`
    : `Còn ${formatSlaRemaining(sla.remainingHours)}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset whitespace-nowrap",
        palette,
        isDanger && "animate-pulse",
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {text}
    </span>
  );
}
