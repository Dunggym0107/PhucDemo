'use client'

import React, { useMemo, useState } from "react";
import { ChevronDown, Building2, Crown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { groupProfilesByDepartment } from "@/lib/profile-grouping";
import { ProfileStatus, ROLE_LABELS, STATUS_BADGES } from "../_lib/constants";

// Cây tổ chức theo phòng ban. Director ở đỉnh, sau đó từng phòng:
//   trưởng phòng (is_department_head) — phóng to chút + huy hiệu Crown.
//   nhân viên còn lại.
// Accordion mặc định BGĐ mở.
interface OrgChartViewProps {
  members: any[];
  onSelect: (member: any) => void;
  getStatus?: (m: any) => ProfileStatus;
}

export default function OrgChartView({ members, onSelect, getStatus }: OrgChartViewProps) {
  const groups = useMemo(() => groupProfilesByDepartment(members as any), [members]);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setOpenMap((m) => ({ ...m, [key]: !m[key] }));

  return (
    <div className="item-stack">
      {groups.map((g) => {
        const open = !!openMap[g.key];
        const head = g.members.find((m: any) => m.is_department_head);
        const rest = g.members.filter((m: any) => m !== head);
        return (
          <section key={g.key} className="rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => toggle(g.key)}
              className="w-full flex items-center justify-between px-4 py-3 min-h-11 hover:bg-slate-50/80"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                  <Building2 className="icon-sm" />
                </span>
                <span className="heading-card truncate">{g.label}</span>
                <span className="text-meta shrink-0">({g.members.length})</span>
              </div>
              <ChevronDown className={cn("icon-sm text-slate-500 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
              <div className="px-3 pb-3 item-stack">
                {head && <OrgPerson member={head} onSelect={onSelect} isHead getStatus={getStatus} />}
                {rest.map((m: any) => (
                  <OrgPerson key={m.id} member={m} onSelect={onSelect} isHead={false} getStatus={getStatus} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function OrgPerson({
  member, onSelect, isHead, getStatus,
}: {
  member: any;
  onSelect: (m: any) => void;
  isHead: boolean;
  getStatus?: (m: any) => ProfileStatus;
}) {
  const status: ProfileStatus = getStatus ? getStatus(member) : 'available';
  const statusBadge = STATUS_BADGES[status];
  const showStatusChip = status !== 'available';

  return (
    <button
      type="button"
      onClick={() => onSelect(member)}
      className={cn(
        "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 min-h-11 text-left transition-all active:scale-[0.99]",
        isHead ? "bg-amber-50/60 border border-amber-100 hover:bg-amber-50" : "bg-slate-50/40 hover:bg-slate-50",
      )}
    >
      <div className="relative shrink-0">
        <Avatar className={cn("ring-2 ring-white shadow-sm", isHead ? "h-11 w-11" : "h-9 w-9")}>
          <AvatarImage src={member.avatar_url} className="object-cover" />
          <AvatarFallback className="bg-primary text-white text-sm font-bold">{member.full_name?.[0]}</AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white",
            statusBadge.dotColor,
          )}
          title={statusBadge.label}
          aria-label={statusBadge.label}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn("font-bold text-slate-900 truncate", isHead ? "text-sm" : "text-sm")}>{member.full_name}</span>
          {isHead && <Crown className="h-3.5 w-3.5 text-amber-600" />}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {member.title && <span className="text-meta truncate">{member.title}</span>}
          {showStatusChip && (
            <Badge className={cn("text-xs font-bold px-2 py-0 rounded-md border", statusBadge.chipClass)}>
              {statusBadge.label}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
