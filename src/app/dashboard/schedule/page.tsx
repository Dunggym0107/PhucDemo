'use client'

import React, { Suspense } from "react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { notifyError, notifySuccess } from "@/lib/notify";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import DateNavigator from "./_components/DateNavigator";
import CalendarView from "./_components/CalendarView";
import { canApproveLeave, canUseDriverWorkspace } from "@/lib/permissions";
import { useSchedule } from "./_hooks/useSchedule";
import PageHeader from "@/components/layout/PageHeader";
import { ListSkeleton } from "@/components/ui/list-skeleton";

const CreateScheduleDialog = React.lazy(() => import("./_components/CreateScheduleDialog"));
const ScheduleDetailDialog = React.lazy(() => import("./_components/ScheduleDetailDialog"));
const DriverDashboard = React.lazy(() => import("./_components/DriverDashboard"));

function ScheduleContent() {
  const scheduleProps = useSchedule();
  const {
    schedules, vehicles, rooms, loading, profile, allProfiles, departments,
    selectedDate, setSelectedDate, filterType, setFilterType,
    isCreateOpen, setIsCreateOpen, newSchedule, setNewSchedule,
    startDate, setStartDate, endDate, setEndDate, startTime, setStartTime, endTime, setEndTime,
    isStartOpen, setIsStartOpen, isEndOpen, setIsEndOpen,
    bgdMode, setBgdMode, selectedBGD, setSelectedBGD,
    deptMode, setDeptMode, filterDepts, setFilterDepts,
    participantMode, setParticipantMode, selectedParticipants, setSelectedParticipants,
    selectedSchedule, isDetailOpen, setIsDetailOpen,
    timelineContainerRef, mounted,
    toast, supabase, pendingVehicleCount,
    canCoordinateResources, pendingLeavesCount,
    sendNotifications, weekDays, isTodaySelected,
    currentTimePercent, startLimit, duration,
    conflicts, resourceConflicts, fetchData,
    handleStatusUpdate, handleUpdateEndTime, handleUpdateSchedule, handleResubmitSchedule, handleCreateSchedule, handleSelectSchedule, handleDeleteSchedule
  } = scheduleProps;

  if (!mounted) {
    return (
      <div className="page-container space-y-10 motion-safe:animate-fade-in-up">
        <PageHeader
          title="Lịch trình"
          description="Điều phối lịch họp & công tác"
        />
        <ListSkeleton variant="card" rows={6} />
      </div>
    );
  }

  // Driver có giao diện chuyên biệt — hiện DriverDashboard thay danh sách lịch chung
  if (canUseDriverWorkspace(profile)) {
    return (
      <div className="page-container space-y-8 motion-safe:animate-fade-in-up">
        <PageHeader
          title="Lịch trình"
          description="Lịch chạy xe & hành trình của bạn"
        />
        <Suspense fallback={<ListSkeleton variant="card" rows={4} />}>
          <DriverDashboard
            schedules={schedules}
            profile={profile}
            fetchData={fetchData}
            toast={toast}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="page-container space-y-10 motion-safe:animate-fade-in-up">
      <PageHeader
        title="Lịch trình"
        description="Điều phối lịch họp & công tác"
        action={
          <Suspense fallback={<Button className="bg-primary hover:bg-primary/90 px-5 font-medium h-11"><Plus className="w-5 h-5 mr-2" /> Đăng ký lịch mới</Button>}>
            <CreateScheduleDialog
              isOpen={isCreateOpen} setIsOpen={setIsCreateOpen}
              newSchedule={newSchedule} setNewSchedule={setNewSchedule}
              startDate={startDate} setStartDate={setStartDate}
              endDate={endDate} setEndDate={setEndDate}
              startTime={startTime} setStartTime={setStartTime}
              endTime={endTime} setEndTime={setEndTime}
              isStartOpen={isStartOpen} setIsStartOpen={setIsStartOpen}
              isEndOpen={isEndOpen} setIsEndOpen={setIsEndOpen}
              rooms={rooms} conflicts={[...conflicts, ...resourceConflicts]} onSubmit={handleCreateSchedule} toast={toast}
              allProfiles={allProfiles} departments={departments}
              bgdMode={bgdMode} setBgdMode={setBgdMode}
              selectedBGD={selectedBGD} setSelectedBGD={setSelectedBGD}
              deptMode={deptMode} setDeptMode={setDeptMode}
              filterDepts={filterDepts} setFilterDepts={setFilterDepts}
              participantMode={participantMode} setParticipantMode={setParticipantMode}
              selectedParticipants={selectedParticipants} setSelectedParticipants={setSelectedParticipants}
              profile={profile}
            />
          </Suspense>
        }
      />

      {/* Chọn ngày */}
      <DateNavigator selectedDate={selectedDate} setSelectedDate={setSelectedDate} weekDays={weekDays} schedules={schedules} />

      {/* View duy nhất — Tablist phạm vi (Toàn chi nhánh / BGĐ / Phòng của tôi)
          đã nhúng sẵn "Điều phối tài nguyên" (cho bộ phận điều phối) và "Duyệt nghỉ phép" (cho lãnh đạo) */}
      <CalendarView
        loading={loading}
        filterType={filterType} setFilterType={setFilterType}
        schedules={schedules} vehicles={vehicles} rooms={rooms}
        selectedDate={selectedDate}
        profile={profile} allProfiles={allProfiles}
        canApproveLeavePermission={canApproveLeave(profile)}
        pendingVehicleCount={pendingVehicleCount}
        pendingLeavesCount={pendingLeavesCount}
        timelineContainerRef={timelineContainerRef}
        isTodaySelected={isTodaySelected} currentTimePercent={currentTimePercent}
        startLimit={startLimit} duration={duration}
        onSelectSchedule={handleSelectSchedule}
        onStatusUpdate={handleStatusUpdate}
      />

      {/* Dialog chi tiết */}
      <Suspense fallback={null}>
        <ScheduleDetailDialog
          isOpen={isDetailOpen} setIsOpen={setIsDetailOpen}
          schedule={selectedSchedule} schedules={schedules} vehicles={vehicles} rooms={rooms}
          allProfiles={allProfiles} departments={departments}
          currentProfile={profile}
          onAssignVehicle={async (id, vId, dId) => {
            try {
              const schedule = schedules.find(s => s.id === id);
              const { error } = await supabase.from('schedules').update({ vehicle_id: vId, driver_id: dId, status: vId ? 'approved' : 'pending' }).eq('id', id);
              if (error) throw error;

              // Thông báo riêng cho tài xế được gán
              if (vId && dId && schedule) {
                const vehicle = vehicles.find(v => v.id === vId);
                await sendNotifications([{
                  user_id: dId,
                  title: "Bạn được phân công lái xe",
                  content: `Bạn được phân công lái xe ${vehicle?.name || ''} (${vehicle?.plate_number || ''}) cho chuyến: "${schedule.title}" – ${new Date(schedule.start_time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`,
                  link: "/dashboard/schedule"
                }]);
              } else if (!vId && schedule?.driver_id) {
                await sendNotifications([{
                  user_id: schedule.driver_id,
                  title: "Đã hủy phân công lái xe",
                  content: `Lịch lái xe "${schedule.title}" đã bị hủy. Vui lòng liên hệ điều phối để biết thêm thông tin.`,
                  link: "/dashboard/schedule"
                }]);
              }

              notifySuccess(vId ? "Đã gán xe và tài xế" : "Đã huỷ gán xe");
              fetchData();
            } catch (error) {
              notifyError(error, "Không gán được xe");
            }
          }}
          onRejectSchedule={async (id, reason) => {
            try {
              const schedule = schedules.find(s => s.id === id);
              const { error } = await supabase.from('schedules').update({
                status: 'rejected',
                rejection_reason: reason,
                rejected_by: profile?.id,
                rejected_at: new Date().toISOString()
              }).eq('id', id);
              if (error) throw error;

              if (schedule?.created_by) {
                await sendNotifications([{
                  user_id: schedule.created_by,
                  title: "Lịch trình đã từ chối",
                  content: `Lịch trình "${schedule.title}" bị từ chối. Lý do: ${reason}`,
                  link: "/dashboard/schedule"
                }]);
              }
              notifySuccess("Đã từ chối lịch trình");
              setIsDetailOpen(false);
              fetchData();
            } catch (error) {
              notifyError(error, "Không từ chối được lịch trình");
            }
          }}
          onSelfArranged={async (id) => {
            try {
              const schedule = schedules.find(s => s.id === id);
              const { error } = await supabase.from('schedules').update({
                use_vehicle: false,
                status: 'approved',
                vehicle_id: null,
                driver_id: null,
              }).eq('id', id);
              if (error) throw error;

              if (schedule?.created_by) {
                await sendNotifications([{
                  user_id: schedule.created_by,
                  title: "Lịch trình đã duyệt — Tự túc phương tiện",
                  content: `Lịch trình "${schedule.title}" đã được duyệt. Phương tiện do các bạn tự sắp xếp.`,
                  link: "/dashboard/schedule"
                }]);
              }
              notifySuccess("Đã duyệt — tự túc phương tiện");
              setIsDetailOpen(false);
              fetchData();
            } catch (error) {
              notifyError(error, "Không duyệt được");
            }
          }}
        onUpdateEndTime={handleUpdateEndTime}
        onUpdateSchedule={handleUpdateSchedule}
        onResubmitSchedule={handleResubmitSchedule}
        onDeleteSchedule={handleDeleteSchedule}
      />
      </Suspense>
    </div>
  );
}

export default function SchedulePage() {
  return <ScheduleContent />;
}

