'use client'

import React from "react";
import Link from "next/link";
import { Building2, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

interface NavItem {
  name: string;
  href: string;
  icon: any;
}

interface Props {
  navItems: NavItem[];
  pathname: string;
  canManageSystem: boolean;
  profile: any;
  onLogout: () => void;
}

export default function DesktopSidebar({ navItems, pathname, canManageSystem, profile, onLogout }: Props) {
  return (
    <aside className="hidden lg:flex flex-col w-[272px] bg-[#f5f5f7]/90 backdrop-blur-xl border-r border-slate-200/70 sticky top-0 h-screen shrink-0 z-50">
      <div className="px-4 py-5 flex items-center gap-3">
        <div className="flex items-center justify-center shrink-0">
          <Logo className="w-9 h-9" />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold text-slate-900 leading-none">WorkFlow</span>
          <span className="text-[11px] text-slate-500 mt-0.5">CN Hoàng Mai</span>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                isActive
                  ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200/70"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
              )}
            >
              <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive ? "text-primary" : "text-slate-500")} />
              {item.name}
            </Link>
          );
        })}

        {canManageSystem && (
          <div className="mt-7 pt-5 border-t border-slate-200/70 space-y-1">
            <p className="px-3 text-[11px] font-medium text-slate-500 mb-1">Hệ thống</p>
            <Link
              href="/dashboard/admin"
              aria-current={pathname === "/dashboard/admin" ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                pathname === "/dashboard/admin"
                  ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200/70"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
              )}
            >
              <ShieldCheck className={cn("w-[18px] h-[18px] shrink-0", pathname === "/dashboard/admin" ? "text-primary" : "text-slate-500")} />
              Quản trị
            </Link>
          </div>
        )}
      </nav>

      <div className="p-4">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/80 shadow-sm ring-1 ring-slate-200/70 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-slate-500" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-slate-500 truncate">Cơ quan</span>
              <span className="text-[13px] font-medium text-slate-900 truncate leading-tight">
                {(profile?.role === 'director' || profile?.role === 'admin') ? "Quản trị & Điều hành" : (profile?.departments?.name || "Chi nhánh chính")}
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl min-h-11 font-medium text-[13px] px-3 focus-visible:ring-2 focus-visible:ring-red-500/20"
          onClick={onLogout}
        >
          <LogOut className="w-4 h-4 mr-2.5" />
          Đăng xuất
        </Button>
      </div>
    </aside>
  );
}
