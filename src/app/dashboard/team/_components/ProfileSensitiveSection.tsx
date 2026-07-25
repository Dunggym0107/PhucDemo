'use client'

import React from "react";
import { Cake, IdCard, AtSign, User2 } from "lucide-react";
import { format } from "date-fns";
import { viLocale as vi } from "@/lib/locale";

// Section hiển thị field nhạy cảm: birthday, ad_account, employee_code, gender.
// Caller phải check canViewSensitiveProfileFields trước khi render component này.
// Component không tự gate — tin tưởng caller.
interface ProfileSensitiveSectionProps {
  target: any;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy", { locale: vi });
  } catch {
    return "—";
  }
}

function fmtGender(g?: string | null) {
  if (!g) return "—";
  const m: Record<string, string> = { male: "Nam", female: "Nữ", other: "Khác" };
  return m[g] ?? g;
}

export default function ProfileSensitiveSection({ target }: ProfileSensitiveSectionProps) {
  if (!target) return null;
  const items = [
    { icon: Cake, label: "Ngày sinh", value: fmtDate(target.birthday) },
    { icon: AtSign, label: "AD account", value: target.ad_account ?? "—" },
    { icon: IdCard, label: "Mã CBNV", value: target.employee_code ?? "—" },
    { icon: User2, label: "Giới tính", value: fmtGender(target.gender) },
  ];

  return (
    <section className="rounded-2xl bg-amber-50/40 border border-amber-100 p-4 group-stack">
      <h4 className="heading-card text-amber-900">Thông tin nhân sự</h4>
      <div className="grid grid-cols-2 gap-3">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="item-stack !gap-1">
            <div className="flex items-center gap-1.5 text-meta">
              <Icon className="icon-sm" />
              <span>{label}</span>
            </div>
            <span className="text-sm font-bold text-slate-900 break-all">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
