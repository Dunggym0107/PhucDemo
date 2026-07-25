'use client'

import React, { useState } from "react";
import { Clock, Loader2, ChevronDown, ChevronUp, Plane, ShieldCheck, AlertTriangle, AlertCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, endOfDay, format, isSameDay, startOfDay } from "date-fns";
import ScheduleCard from "./ScheduleCard";
import DirectorTimeline from "./DirectorTimeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { canCoordinateSharedResources } from "@/lib/permissions";

const ResourcesManagerDashboard = React.lazy(() => import("./ResourcesManagerDashboard"));
const LeaveApprovalDashboard = React.lazy(() => import("./LeaveApprovalDashboard"));

interface CalendarViewProps {
  loading: boolean;
  filterType: 'all' | 'bgd' | 'dept';
  setFilterType: (v: 'all' | 'bgd' | 'dept') => void;
  schedules: any[];
  vehicles: any[];
  rooms: any[];
  selectedDate: Date;
  profile: any;
  allProfiles: any[];
  canApproveLeavePermission: boolean;
  pendingVehicleCount: number;
  pendingLeavesCount: number;
  timelineContainerRef: React.RefObject<HTMLDivElement | null>;
  isTodaySelected: boolean;
  currentTimePercent: number;
  startLimit: number;
  duration: number;
  onSelectSchedule: (s: any) => void;
  onStatusUpdate: (id: string, status: string, reason?: string) => Promise<void>;
}

interface SectionProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: 'red' | 'amber' | 'green' | 'blue' | 'slate';
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function ScheduleSection({ icon, label, count, color, defaultOpen = true, children }: SectionProps) {
  const colorMap = {
    red: { badge: "bg-red-100 text-red-700", header: "text-red-600", bg: "bg-red-50/30", leftBar: "bg-red-400" },
    amber: { badge: "bg-amber-100 text-amber-700", header: "text-amber-600", bg: "bg-amber-50/30", leftBar: "bg-amber-400" },
    green: { badge: "bg-emerald-100 text-emerald-700", header: "text-emerald-600", bg: "bg-emerald-50/30", leftBar: "bg-emerald-400" },
    blue: { badge: "bg-blue-100 text-blue-700", header: "text-blue-600", bg: "bg-blue-50/30", leftBar: "bg-blue-400" },
    slate: { badge: "bg-slate-100 text-slate-500", header: "text-slate-500", bg: "bg-slate-50/30", leftBar: "bg-slate-300" },
  };
  const c = colorMap[color];

  if (count === 0) return null;

  return (
    <Collapsible defaultOpen={defaultOpen && count > 0} className="space-y-1.5">
      <CollapsibleTrigger
        className={cn(
          "group w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
          c.bg, "hover:brightness-[0.96] transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        )}
      >
        <div className={cn("w-1 h-4 rounded-full shrink-0", c.leftBar)} />
        <span className={cn("shrink-0", c.header)}>{icon}</span>
        <span className={cn("text-xs font-semibold tracking-tight", c.header)}>{label}</span>
        <Badge className={cn("h-4.5 min-w-4.5 rounded-full border-0 px-1.5 text-xs font-bold leading-none flex items-center justify-center", c.badge)}>
          {count}
        </Badge>
        <ChevronDown className="ml-auto w-3 h-3 text-slate-500 transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1.5">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function CalendarView(props: CalendarViewProps) {
  const {
    loading, filterType, setFilterType, schedules, vehicles, rooms,
    selectedDate, profile, allProfiles,
    canApproveLeavePermission, pendingVehicleCount, pendingLeavesCount,
    timelineContainerRef, isTodaySelected, currentTimePercent, startLimit, duration,
    onSelectSchedule, onStatusUpdate
  } = props;

  const isCoordinator = canCoordinateSharedResources(profile);

  const isParticipant = (s: any) => {
    if (!profile?.id) return false;
    return (s.participants || []).some((p: any) => p.profile?.id === profile.id || p.profile_id === profile.id);
  };

  // Helper: ai được xem rejected
  const canSeeRejected = (s: any) => {
    if (s.status !== 'rejected') return true;
    if (s.created_by === profile?.id) return true;
    if (isParticipant(s)) return true;
    if (['admin', 'secretary'].includes(profile?.role)) return true;
    if (isCoordinator) return true;
    return false;
  };

  // ── Nhóm schedules ──

  // 🔴 Cần xử lý
  const needsAction = React.useMemo(() => {
    return schedules.filter(s => {
      // Lịch bị từ chối (creator + admin/coordinator thấy)
      if (s.status === 'rejected' && canSeeRejected(s)) return true;
      // Lịch chờ gán xe (coordinator thấy)
      if (isCoordinator && s.use_vehicle && !s.vehicle_id && s.status === 'pending') return true;
      return false;
    });
  }, [schedules, profile, isCoordinator]);

  // 🟡 Đang chờ phê duyệt
  const pendingApproval = React.useMemo(() => {
    return schedules.filter(s => {
      if (s.status === 'rejected') return false;
      if (s.status !== 'pending') return false;

      const isCreator = s.created_by === profile?.id;
      const participant = isParticipant(s);

      // Lịch xe chưa gán: điều phối xử lý ở section "Cần xử lý".
      // Nhưng creator/participant vẫn phải thấy ở lịch của mình để biết đang chờ.
      if (s.use_vehicle && !s.vehicle_id && isCoordinator && !isCreator && !participant) return false;

      if (isCreator) return true;
      if (participant) return true;
      if (['admin', 'secretary', 'director'].includes(profile?.role)) return true;
      if (isCoordinator) return true;
      return false;
    });
  }, [schedules, profile, isCoordinator]);

  // 🟢 Hôm nay
  const todaySchedules = React.useMemo(() => {
    const selectedStart = startOfDay(selectedDate);
    const selectedEnd = endOfDay(selectedDate);
    return schedules.filter(s => {
      if (new Date(s.start_time) > selectedEnd || new Date(s.end_time) < selectedStart) return false;
      if (!canSeeRejected(s)) return false;
      if (s.status === 'pending') return false; // pending đã ở section Đang chờ
      if (s.status === 'rejected') return false; // rejected đã ở section Cần xử lý
      if (s.status === 'completed') return false; // completed đã ở Đã hoàn thành
      if (filterType === 'dept') return s.department_id === profile?.department_id;
      return true;
    });
  }, [schedules, selectedDate, filterType, profile]);

  // 🔵 Sắp tới (3 ngày)
  const upcomingSchedules = React.useMemo(() => {
    const selectedEnd = endOfDay(selectedDate);
    const rangeEnd = endOfDay(addDays(selectedDate, 3));
    return schedules
      .filter(s => {
        const start = new Date(s.start_time);
        if (start <= selectedEnd || start > rangeEnd) return false;
        if (!canSeeRejected(s)) return false;
        if (s.status === 'pending') return false;
        if (s.status === 'rejected') return false;
        if (s.status === 'completed') return false;
        if (filterType === 'dept') return s.department_id === profile?.department_id;
        return true;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 8);
  }, [schedules, selectedDate, filterType, profile]);

  // ⚪️ Đã hoàn thành
  const completedSchedules = React.useMemo(() => {
    const selectedStart = startOfDay(selectedDate);
    const selectedEnd = endOfDay(selectedDate);
    return schedules.filter(s => {
      if (!canSeeRejected(s)) return false;
      if (s.status !== 'completed') return false;
      if (new Date(s.start_time) > selectedEnd || new Date(s.end_time) < selectedStart) return false;
      if (filterType === 'dept') return s.department_id === profile?.department_id;
      return true;
    }).slice(0, 10);
  }, [schedules, selectedDate, filterType, profile]);

  // Danh sách nhân sự nghỉ phép
  const leaveList = React.useMemo(() => {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    return schedules
      .filter(s => s.type === 'leave' && s.status === 'approved')
      .map(s => {
        const start = new Date(s.start_time);
        const end = new Date(s.end_time);
        const isCurrent = start <= todayEnd && end >= todayStart;
        return { ...s, isCurrent, startDate: start, endDate: end };
      })
      .filter(leave => leave.endDate >= todayStart)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [schedules]);

  const getProfileDeptName = (profileId: string) => {
    const p = allProfiles.find(ap => ap.id === profileId);
    if (!p) return "";
    const dept = p.departments;
    return Array.isArray(dept) ? dept[0]?.name : dept?.name;
  };

  return (
    <div className="section-stack animate-in fade-in duration-500">
      {/* Tablist phạm vi */}
      <Tabs value={filterType} onValueChange={(value) => setFilterType(value as 'all' | 'bgd' | 'dept')} className="w-full">
        <TabsList className={`grid min-h-9 ${isCoordinator ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {isCoordinator && (
            <TabsTrigger value="all" className="rounded-lg px-2 text-xs font-medium md:text-sm relative">
              <span className="truncate">Chi nhánh</span>
              {pendingVehicleCount > 0 && (
                <Badge className="ml-1.5 h-5 min-w-5 shrink-0 justify-center rounded-full border-none bg-amber-600 px-1.5 text-xs font-bold leading-none text-white tabular-nums">
                  {pendingVehicleCount > 9 ? "9+" : pendingVehicleCount}
                </Badge>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="bgd" className="rounded-lg px-2 text-xs font-medium md:text-sm">
            <span className="truncate">Ban giám đốc</span>
          </TabsTrigger>
          <TabsTrigger value="dept" className="rounded-lg px-2 text-xs font-medium md:text-sm relative">
            <span className="truncate">Phòng của tôi</span>
            {canApproveLeavePermission && pendingLeavesCount > 0 && (
              <Badge className="ml-1.5 h-5 min-w-5 shrink-0 justify-center rounded-full border-none bg-slate-900 px-1.5 text-xs font-bold leading-none text-white tabular-nums">
                {pendingLeavesCount > 9 ? "9+" : pendingLeavesCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Điều phối tài nguyên */}
      {filterType === 'all' && isCoordinator && (
        <Collapsible defaultOpen={false} className="item-stack">
          <CollapsibleTrigger className="group w-full flex items-center gap-2 px-2 py-2 rounded-xl text-label transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Điều phối tài nguyên</span>
            {pendingVehicleCount > 0 && (
              <Badge className="h-5 rounded-full border border-amber-100 bg-amber-50 px-2.5 text-xs font-bold text-amber-700">
                {pendingVehicleCount} lịch cần xe
              </Badge>
            )}
            <ChevronDown className="ml-auto w-4 h-4 text-slate-500 transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0" />
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
            <React.Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-primary mx-auto my-8" />}>
              <ResourcesManagerDashboard schedules={schedules} vehicles={vehicles} rooms={rooms} selectedDate={selectedDate} onSelectSchedule={onSelectSchedule} />
            </React.Suspense>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Đơn nghỉ phép chờ duyệt */}
      {filterType === 'dept' && canApproveLeavePermission && pendingLeavesCount > 0 && (
        <Collapsible defaultOpen={true} className="item-stack">
          <CollapsibleTrigger className="group w-full flex items-center gap-2 px-2 py-2 rounded-xl text-label transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Đơn nghỉ phép chờ duyệt</span>
            <Badge className="h-5 rounded-full border border-amber-100 bg-amber-50 px-2.5 text-xs font-bold text-amber-700">{pendingLeavesCount} đơn</Badge>
            <ChevronDown className="ml-auto w-4 h-4 text-slate-500 transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0" />
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
            <React.Suspense fallback={<Loader2 className="h-6 w-6 animate-spin text-primary mx-auto my-8" />}>
              <LeaveApprovalDashboard schedules={schedules} profile={profile} onStatusUpdate={onStatusUpdate} />
            </React.Suspense>
          </CollapsibleContent>
        </Collapsible>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filterType === 'bgd' ? (
        <DirectorTimeline
          allProfiles={allProfiles} schedules={schedules} selectedDate={selectedDate}
          timelineContainerRef={timelineContainerRef} isTodaySelected={isTodaySelected}
          currentTimePercent={currentTimePercent} startLimit={startLimit} duration={duration}
          onSelectSchedule={onSelectSchedule} currentProfile={profile}
        />
      ) : (
        <div className="group-stack">
          {/* 🔴 Cần xử lý */}
          <ScheduleSection
            icon={<XCircle className="w-3.5 h-3.5" />}
            label="Cần xử lý"
            count={needsAction.length}
            color="red"
          >
            {needsAction.map(item => (
              <ScheduleCard key={item.id} item={item} profile={profile} onSelect={onSelectSchedule} onStatusUpdate={onStatusUpdate} />
            ))}
          </ScheduleSection>

          {/* 🟡 Đang chờ */}
          <ScheduleSection
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Đang chờ"
            count={pendingApproval.length}
            color="amber"
            defaultOpen={false}
          >
            {pendingApproval.map(item => (
              <ScheduleCard key={item.id} item={item} profile={profile} onSelect={onSelectSchedule} onStatusUpdate={onStatusUpdate} />
            ))}
          </ScheduleSection>

          {/* 🟢 Hôm nay */}
          {todaySchedules.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-50/30">
                <div className="w-1 h-4 rounded-full shrink-0 bg-emerald-400" />
                <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                <span className="text-xs font-semibold tracking-tight text-emerald-600">Lịch trình ngày {format(selectedDate, 'dd/MM/yyyy')}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {todaySchedules.map(item => (
                  <ScheduleCard key={item.id} item={item} profile={profile} onSelect={onSelectSchedule} onStatusUpdate={onStatusUpdate} />
                ))}
              </div>
            </div>
          )}

          {/* 🔵 Sắp tới */}
          <ScheduleSection
            icon={<AlertCircle className="w-3.5 h-3.5" />}
            label="Sắp tới"
            count={upcomingSchedules.length}
            color="blue"
            defaultOpen={false}
          >
            {upcomingSchedules.map(item => (
              <ScheduleCard key={`upcoming-${item.id}`} item={item} profile={profile} onSelect={onSelectSchedule} onStatusUpdate={onStatusUpdate} />
            ))}
          </ScheduleSection>

          {/* ⚪️ Đã hoàn thành */}
          <ScheduleSection
            icon={<ChevronDown className="w-3.5 h-3.5" />}
            label="Đã hoàn thành"
            count={completedSchedules.length}
            color="slate"
            defaultOpen={false}
          >
            {completedSchedules.map(item => (
              <ScheduleCard key={item.id} item={item} profile={profile} onSelect={onSelectSchedule} onStatusUpdate={onStatusUpdate} />
            ))}
          </ScheduleSection>

          {/* Danh sách người nghỉ phép */}
          {leaveList.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-slate-100 mt-8">
              <div className="flex items-center justify-between px-2">
                <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <Plane className="w-4 h-4 text-blue-500 shrink-0" />
                  Nhân sự nghỉ phép ({leaveList.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {leaveList.map(leave => {
                  const deptName = getProfileDeptName(leave.created_by);
                  const formattedRange = isSameDay(leave.startDate, leave.endDate)
                    ? format(leave.startDate, 'dd/MM/yyyy')
                    : `${format(leave.startDate, 'dd/MM')} - ${format(leave.endDate, 'dd/MM/yyyy')}`;
                  return (
                    <Card key={leave.id} onClick={() => onSelectSchedule(leave)}
                      className="rounded-2xl overflow-hidden border-none shadow-sm hover:shadow-lg transition-all duration-300 group cursor-pointer hover:-translate-y-0.5 hover:bg-slate-50/30">
                      <CardContent className="p-0">
                        <div className="flex h-full">
                          <div className={cn("w-2 shrink-0", leave.isCurrent ? "bg-amber-400" : "bg-blue-400")} />
                          <div className="flex-1 p-3.5 flex items-center gap-3.5 min-w-0">
                            <Avatar className="h-9 w-9 shrink-0 border border-slate-100 shadow-sm">
                              <AvatarImage src={leave.creator?.avatar_url} />
                              <AvatarFallback className="text-xs bg-slate-100 font-bold text-slate-600">{leave.creator?.full_name?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-bold text-slate-800 truncate group-hover:text-primary transition-colors">{leave.creator?.full_name}</p>
                                <span className={cn("text-xs font-bold px-2 py-0.5 rounded-md tracking-normal shrink-0", leave.isCurrent ? "bg-amber-50 text-amber-600 border border-amber-200/50" : "bg-blue-50/50 text-blue-600 border border-blue-200/40")}>
                                  {leave.isCurrent ? "Đang nghỉ" : "Sắp nghỉ"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-bold truncate">{deptName || "Chưa phân phòng"}</p>
                              <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100">
                                <span className="text-xs font-medium text-slate-500">Thời gian nghỉ:</span>
                                <span className="text-xs font-semibold text-slate-700">{formattedRange}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
