'use client'

import React from "react";
import Link from "next/link";
import { ShieldAlert, ChevronRight } from "lucide-react";

interface Props {
  show: boolean;
}

export default function MustChangePasswordBanner({ show }: Props) {
  if (!show) return null;
  return (
    <div className="max-w-[72rem] mx-auto px-[var(--app-page-x)] mb-6 animate-in fade-in slide-in-from-top-2">
      <Link
        href="/dashboard/profile#change-password"
        className="group relative flex items-center gap-3 lg:gap-4 overflow-hidden rounded-2xl border border-amber-200/50 bg-gradient-to-r from-amber-50 to-amber-100/30 p-3 lg:p-4 shadow-sm transition-all hover:border-amber-300 hover:shadow-md"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 shadow-inner">
          <ShieldAlert className="h-5 w-5" />
        </div>
        
        <div className="flex flex-1 flex-col min-w-0">
          <h3 className="text-[13px] lg:text-sm font-bold text-amber-900 truncate">
            Bảo mật tài khoản
          </h3>
          <p className="text-[12px] lg:text-[13px] font-medium text-amber-700/80 truncate">
            Bạn đang dùng mật khẩu mặc định. Vui lòng đổi mật khẩu mới.
          </p>
        </div>

        <div className="flex h-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 pl-3 pr-2 text-[12px] font-bold text-amber-700 transition-colors group-hover:bg-amber-500/20">
          <span className="hidden sm:inline mr-1">Đổi ngay</span>
          <ChevronRight className="icon-md" />
        </div>
      </Link>
    </div>
  );
}
