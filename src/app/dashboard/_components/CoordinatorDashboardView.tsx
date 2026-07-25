'use client'

import React from "react";
import Link from "next/link";
import { CalendarDays, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DirectorTimeline from "../schedule/_components/DirectorTimeline";
import ResourcesManagerDashboard from "../schedule/_components/ResourcesManagerDashboard";
import ScheduleDetailDialog from "../schedule/_components/ScheduleDetailDialog";

interface CoordinatorViewProps {
  profile: any;
  schedules: any[];
  vehicles: any[];
  rooms: any[];
  allProfiles: any[];
  departments: any[];
  selectedDate: Date;
  isTodaySelected: boolean;
  currentTimePercent: number;
  startLimit: number;
  duration: number;
  timelineContainerRef: React.RefObject<HTMLDivElement | null>;
  selectedSchedule: any;
  isDetailOpen: boolean;
  setIsDetailOpen: (v: boolean) => void;
  handleSelectSchedule: (s: any) => void;
  handleAssignVehicle: (id: string, vId: string | null, dId: string | null) => void;
  handleSelfArranged: (id: string) => void;
  handleUpdateEndTime: (id: string, t: string) => void;
  handleUpdateSchedule: (id: string, u: any) => void;
}

export default function CoordinatorDashboardView(props: CoordinatorViewProps) {
  const {
    profile, schedules, vehicles, rooms, allProfiles, departments,
    selectedDate, isTodaySelected, currentTimePercent, startLimit, duration,
    timelineContainerRef, selectedSchedule, isDetailOpen, setIsDetailOpen,
    handleSelectSchedule, handleAssignVehicle, handleSelfArranged, handleUpdateEndTime, handleUpdateSchedule
  } = props;

  const pendingSchedules = schedules
    .filter(s => s.status === 'pending' || (s.use_vehicle && !s.vehicle_id))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 6);
  const busyVehicles = schedules.filter(s =>
    s.vehicle_id && ['approved', 'in_progress'].includes(s.status) && new Date(s.end_time) >= new Date()
  ).length;
  const busyRooms = schedules.filter(s =>
    s.room_id && s.status === 'approved' && new Date(s.end_time) >= new Date()
  ).length;

  return (
    <div className="page-container space-y-8 motion-safe:animate-fade-in-up pb-20">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 sm:pt-0">
        <div className="space-y-1">
          <h1 className="heading-page">Bảng điều phối</h1>
          <p className="text-subtitle">Duyệt lịch, điều phối xe/phòng và theo dõi lịch Ban Giám đốc.</p>
        </div>
        <Button asChild className="min-h-11 rounded-xl font-bold">
          <Link href="/dashboard/schedule">
            <CalendarDays className="mr-2 icon-sm" /> Mở lịch trình
          </Link>
        </Button>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="premium-card border border-slate-200 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="heading-card flex items-center gap-2">
              <ShieldCheck className="icon-sm text-amber-600" /> Cần xử lý
            </h2>
            <Badge className="border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">{pendingSchedules.length}</Badge>
          </div>
          <div className="item-stack">
            {pendingSchedules.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 font-medium">Không có lịch chờ điều phối.</p>
            ) : pendingSchedules.map((schedule) => (
              <Button
                type="button"
                variant="outline"
                key={schedule.id}
                onClick={() => handleSelectSchedule(schedule)}
                className="h-auto w-full justify-start rounded-xl border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
              >
                <div className="w-full">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900 line-clamp-1">{schedule.title}</p>
                    <Badge className="shrink-0 border-none bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                      {schedule.use_vehicle && !schedule.vehicle_id ? "Cần xe" : "Chờ duyệt"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500 line-clamp-1">
                    {new Date(schedule.start_time).toLocaleString('vi-VN')} - {schedule.creator?.full_name || 'Người tạo'}
                  </p>
                </div>
              </Button>
            ))}
          </div>
        </div>

        <div className="premium-card border border-slate-200">
          <h2 className="heading-card flex items-center gap-2">
            <CalendarDays className="icon-sm text-slate-500" /> Tài nguyên hôm nay
          </h2>
          <div className="item-stack">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-label">Xe đang có lịch</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{busyVehicles}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-label">Phòng đang có lịch</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{busyRooms}</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-label !text-amber-700">Tổng lịch cần theo dõi</p>
              <p className="mt-1 text-2xl font-bold text-amber-700 tabular-nums">{schedules.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="heading-card flex items-center gap-2">
          <CalendarDays className="icon-sm text-slate-700" /> Timeline Ban Giám đốc
        </h2>
        <DirectorTimeline
          allProfiles={allProfiles}
          schedules={schedules}
          selectedDate={selectedDate}
          timelineContainerRef={timelineContainerRef}
          isTodaySelected={isTodaySelected}
          currentTimePercent={currentTimePercent}
          startLimit={startLimit}
          duration={duration}
          onSelectSchedule={handleSelectSchedule}
          currentProfile={profile}
        />
      </section>

      <ResourcesManagerDashboard
        schedules={schedules}
        vehicles={vehicles}
        rooms={rooms}
        selectedDate={selectedDate}
        onSelectSchedule={handleSelectSchedule}
      />

      <ScheduleDetailDialog
        isOpen={isDetailOpen}
        setIsOpen={setIsDetailOpen}
        schedule={selectedSchedule}
        schedules={schedules}
        vehicles={vehicles}
        rooms={rooms}
        allProfiles={allProfiles}
        departments={departments}
        currentProfile={profile}
        onAssignVehicle={handleAssignVehicle}
        onSelfArranged={handleSelfArranged}
        onRejectSchedule={(id, reason) => Promise.resolve()}
        onUpdateEndTime={handleUpdateEndTime}
        onUpdateSchedule={handleUpdateSchedule}
      />
    </div>
  );
}
