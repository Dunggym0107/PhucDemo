'use client'

import React from "react";
import Link from "next/link";
import { CalendarDays, Clock, Users } from "lucide-react";
import { startOfWeek, endOfWeek } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

interface HRViewProps {
  schedules: any[];
  allProfiles: any[];
}

export default function HRDashboardView({ schedules, allProfiles }: HRViewProps) {
  const today = new Date();
  const approvedLeaves = schedules.filter(s => s.type === 'leave' && s.status === 'approved');
  const activeLeaves = approvedLeaves.filter(s => new Date(s.start_time) <= today && new Date(s.end_time) >= today);

  const start = startOfWeek(today, { weekStartsOn: 1 });
  const end = endOfWeek(today, { weekStartsOn: 1 });
  const thisWeekLeaves = approvedLeaves.filter(s => {
    const sStart = new Date(s.start_time);
    const sEnd = new Date(s.end_time);
    return sStart <= end && sEnd >= start;
  });

  return (
    <div className="page-container space-y-8 motion-safe:animate-fade-in-up pb-20">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 sm:pt-0">
        <div className="space-y-1">
          <h1 className="heading-page">Bảng nhân sự</h1>
          <p className="text-subtitle">Theo dõi nghỉ phép và hồ sơ nhân sự toàn cơ quan.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="rounded-xl border-primary/20 font-semibold text-primary hover:border-primary/40 hover:bg-primary/5">
            <Link href="/dashboard/schedule?type=leave" className="flex items-center justify-center gap-2">
              <CalendarDays className="icon-md shrink-0" />
              <span>Đăng ký nghỉ phép</span>
            </Link>
          </Button>
          <Button asChild className="rounded-xl font-semibold">
            <Link href="/dashboard/team" className="flex items-center justify-center gap-2">
              <Users className="icon-md shrink-0" />
              <span>Danh sách cán bộ</span>
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="premium-card border border-slate-100 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xs font-semibold text-slate-500">Nghỉ phép tuần này</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 tabular-nums">{thisWeekLeaves.length}</p>
        </div>
        <div className="premium-card border border-slate-100 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-xs font-semibold text-slate-500">Đang nghỉ hôm nay</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 tabular-nums">{activeLeaves.length}</p>
        </div>
        <div className="premium-card border border-slate-100 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xs font-semibold text-slate-500">Tổng cán bộ</p>
          </div>
          <p className="text-3xl font-bold text-slate-900 tabular-nums">{allProfiles.length}</p>
        </div>
      </section>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-500 flex items-center gap-2 px-1">
          <CalendarDays className="w-4 h-4 text-primary shrink-0" />
          Lịch nghỉ phép tuần này
          <Badge className="ml-auto border-none bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{thisWeekLeaves.length}</Badge>
        </h3>

        {thisWeekLeaves.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="icon-lg" />}
            title="Tuần này không có cán bộ nghỉ phép"
            variant="card"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {thisWeekLeaves.map((leave) => {
              const startDate = new Date(leave.start_time);
              const endDate = new Date(leave.end_time);
              const isActive = startDate <= today && endDate >= today;
              const leaveUser = leave.participants?.[0]?.profile || leave.creator;
              const userDept = leaveUser?.departments;
              const deptName = userDept ? (Array.isArray(userDept) ? userDept[0]?.name : userDept?.name) : "";

              return (
                <div key={leave.id} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all duration-200">
                  <Avatar className="h-10 w-10 border border-slate-100 shadow-sm shrink-0">
                    <AvatarImage src={leaveUser?.avatar_url} />
                    <AvatarFallback className="font-semibold text-sm status-neutral-bg">
                      {leaveUser?.full_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 truncate">{leaveUser?.full_name || "Cán bộ"}</p>
                      {isActive && (
                        <Badge className="shrink-0 border border-amber-100 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          Hôm nay
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{leave.title || "Nghỉ phép"}</p>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      {startDate.toLocaleDateString("vi-VN")} – {endDate.toLocaleDateString("vi-VN")}
                      {deptName ? ` · ${deptName}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
