'use client';

// Dashboard page — chỉ là dispatcher 4 view:
//   - DriverDashboardView (lái xe)
//   - HRDashboardView (nhân sự)
//   - CoordinatorDashboardView (bộ phận điều phối tài nguyên chi nhánh)
//   - DefaultDashboardView (admin/director/manager/staff thường — 90% người dùng)
// Default view gọi RPC dashboard_summary() qua hook nội bộ.
// Legacy schedule data chỉ fetch khi role thực sự cần — KHÔNG còn chạy cho default user.

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, endOfDay, endOfWeek, isSameDay, startOfWeek } from 'date-fns';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  canCoordinateSharedResources,
  canUseDriverWorkspace,
  canUseHumanResourcesWorkspace,
} from '@/lib/permissions';
import { useAppData } from '@/hooks/use-app-data';
import { fetchScheduleData } from './schedule/_lib/fetchScheduleData';
import DriverDashboardView from './_components/DriverDashboardView';
import HRDashboardView from './_components/HRDashboardView';
import CoordinatorDashboardView from './_components/CoordinatorDashboardView';
import DefaultDashboardView from './_components/DefaultDashboardView';
import DashboardLoading from './_components/DashboardLoading';

interface LegacyScheduleState {
  schedules: any[];
}

const EMPTY_SCHEDULE: LegacyScheduleState = {
  schedules: [],
};

function DashboardContent() {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();
  // Profiles + departments + profile của user lấy từ AppDataProvider (shared cache)
  const {
    profiles: cachedProfiles,
    departments: cachedDepartments,
    vehicles: cachedVehicles,
    rooms: cachedRooms,
    currentProfile,
    hydrating,
  } = useAppData();

  const profile = currentProfile;
  const profileLoading = hydrating && !currentProfile;

  // Legacy state — chỉ dùng cho Driver/HR/Coordinator.
  const [scheduleData, setScheduleData] = useState<LegacyScheduleState>(EMPTY_SCHEDULE);
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const selectedDate = new Date();
  const isTodaySelected = isSameDay(selectedDate, new Date());
  const now = new Date();
  const startLimit = 7 * 60;
  const endLimit = 19 * 60;
  const duration = endLimit - startLimit;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimePercent =
    currentMinutes >= startLimit && currentMinutes <= endLimit
      ? ((currentMinutes - startLimit) / duration) * 100
      : -1;

  // Legacy schedule (timeline + pending queue) chỉ cần cho Driver/HR/Coordinator view.
  // CoordinatorDashboardView giờ chỉ dành cho secretary (lễ tân) — admin/director/manager
  // (kể cả TCTH) đều dùng DefaultDashboardView; coordinator queue thao tác qua /schedule.
  const needsLegacySchedule = profile
    ? canUseDriverWorkspace(profile)
      || canUseHumanResourcesWorkspace(profile)
      || profile.role === 'secretary'
    : false;

  // Step 1: profile lấy từ AppDataProvider — không còn fetch riêng tại đây.

  // Step 2: legacy schedule fetch — chỉ chạy khi profile yêu cầu.
  // Dùng helper chung fetchScheduleData (đã gộp 1 SELECT với OR condition).
  // Vehicles/rooms/profiles/departments lấy từ AppDataProvider (cache 24h, realtime invalidate).
  const fetchScheduleDashboardData = async (currentProfile: any) => {
    const result = await fetchScheduleData(supabase, selectedDate, currentProfile);
    setScheduleData({ schedules: result.schedules });
  };

  useEffect(() => {
    if (!profile || !needsLegacySchedule) return;
    let active = true;
    (async () => {
      setLegacyLoading(true);
      try {
        await fetchScheduleDashboardData(profile);
      } catch (e) {
        console.error('legacy schedule fetch error:', e);
      } finally {
        if (active) setLegacyLoading(false);
      }
    })();

    // Realtime hẹp cho legacy view — chỉ subscribe schedule + participants.
    // vehicles/rooms đã được AppDataProvider subscribe → không cần lặp lại ở đây.
    // Tách INSERT/UPDATE/DELETE để DB chỉ broadcast khi cần (event:'*' bao gồm cả TRUNCATE).
    let refetchTimer: any = null;
    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => {
        if (active) fetchScheduleDashboardData(profile);
      }, 600);
    };
    const channel = supabase
      .channel('dashboard_legacy_schedule_sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'schedules' }, scheduleRefetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'schedules' }, scheduleRefetch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'schedules' }, scheduleRefetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'schedule_participants' }, scheduleRefetch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'schedule_participants' }, scheduleRefetch)
      .subscribe();

    return () => {
      active = false;
      if (refetchTimer) clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, needsLegacySchedule, supabase]);

  const refetchLegacy = async () => {
    if (!profile) return;
    try {
      await fetchScheduleDashboardData(profile);
    } catch (e) {
      console.error(e);
    }
  };

  const sendNotifications = async (rows: any[]) => {
    const uniqueRows = rows.filter((row, index, arr) =>
      row?.user_id && arr.findIndex(item =>
        item.user_id === row.user_id
        && item.title === row.title
        && item.content === row.content
        && item.link === row.link,
      ) === index,
    );
    if (uniqueRows.length === 0) return;
    const { error } = await supabase.from('notifications').insert(uniqueRows);
    if (error) console.error('Notification insert failed:', error);
  };

  const handleSelectSchedule = (schedule: any) => {
    setSelectedSchedule(schedule);
    setIsDetailOpen(true);
  };

  const handleUpdateEndTime = async (id: string, newEndTimeStr: string) => {
    try {
      const { error } = await supabase
        .from('schedules')
        .update({ end_time: new Date(newEndTimeStr).toISOString() })
        .eq('id', id);
      if (error) throw error;
      notifySuccess('Đã cập nhật thời gian kết thúc');
      refetchLegacy();
    } catch (error) {
      notifyError(error, 'Không cập nhật được thời gian kết thúc');
    }
  };

  const handleUpdateSchedule = async (id: string, updates: any) => {
    try {
      const { participant_ids, ...scheduleUpdates } = updates;
      const { error } = await supabase.from('schedules').update(scheduleUpdates).eq('id', id);
      if (error) throw error;

      if (Array.isArray(participant_ids)) {
        const schedule = scheduleData.schedules.find(s => s.id === id);
        const finalParticipantIds = Array.from(
          new Set([schedule?.created_by, ...participant_ids].filter(Boolean)),
        );
        const { error: deleteError } = await supabase
          .from('schedule_participants')
          .delete()
          .eq('schedule_id', id);
        if (deleteError) throw deleteError;
        if (finalParticipantIds.length > 0) {
          const { error: insertError } = await supabase.from('schedule_participants').insert(
            finalParticipantIds.map((uid: string) => ({ schedule_id: id, profile_id: uid })),
          );
          if (insertError) throw insertError;
        }
      }

      notifySuccess('Đã cập nhật lịch trình');
      setIsDetailOpen(false);
      refetchLegacy();
    } catch (error) {
      notifyError(error, 'Không cập nhật được lịch trình');
    }
  };

  const handleAssignVehicle = async (id: string, vehicleId: string | null, driverId: string | null) => {
    try {
      const schedule = scheduleData.schedules.find(s => s.id === id);
      const { error } = await supabase
        .from('schedules')
        .update({ vehicle_id: vehicleId, driver_id: driverId, status: vehicleId ? 'approved' : 'pending' })
        .eq('id', id);
      if (error) throw error;

      if (vehicleId && driverId && schedule) {
        const vehicle = cachedVehicles.find((v: any) => v.id === vehicleId);
        await sendNotifications([{
          user_id: driverId,
          title: 'Bạn được phân công lịch chạy xe',
          content: `Bạn được phân công điều khiển xe ${vehicle?.name || ''} (${vehicle?.plate_number || ''}) cho chuyến: "${schedule.title}".`,
          link: '/dashboard/schedule',
        }]);
      }

      notifySuccess(vehicleId ? 'Đã gán xe và tài xế' : 'Đã huỷ gán xe');
      setIsDetailOpen(false);
      refetchLegacy();
    } catch (error) {
      notifyError(error, 'Không gán được xe');
    }
  };

  // Render: chờ profile và cache hydrate xong rồi mới quyết định view.
  if (profileLoading || (hydrating && needsLegacySchedule)) {
    return <DashboardLoading />;
  }

  if (canUseDriverWorkspace(profile)) {
    if (legacyLoading) {
      return <DashboardLoading />;
    }
    return (
      <DriverDashboardView
        profile={profile}
        schedules={scheduleData.schedules}
        fetchData={refetchLegacy}
        toast={toast}
      />
    );
  }

  if (canUseHumanResourcesWorkspace(profile)) {
    if (legacyLoading) {
      return <DashboardLoading />;
    }
    return (
      <HRDashboardView
        schedules={scheduleData.schedules}
        allProfiles={cachedProfiles.filter((p: any) => p.role !== 'admin')}
      />
    );
  }

  // CoordinatorDashboardView (timeline + pending queue duyệt xe/phòng) chỉ dành cho
  // secretary (lễ tân). Manager mọi phòng đều dùng DefaultDashboardView — tránh trải
  // nghiệm khác nhau giữa TP TCTH vs TP phòng khác (gây khó training).
  const isResourcesManagerDashboard = profile?.role === 'secretary';
  if (isResourcesManagerDashboard) {
    if (legacyLoading) {
      return <DashboardLoading />;
    }
    return (
      <CoordinatorDashboardView
        profile={profile}
        schedules={scheduleData.schedules}
        vehicles={cachedVehicles}
        rooms={cachedRooms}
        allProfiles={cachedProfiles.filter((p: any) => p.role !== 'admin')}
        departments={cachedDepartments}
        selectedDate={selectedDate}
        isTodaySelected={isTodaySelected}
        currentTimePercent={currentTimePercent}
        startLimit={startLimit}
        duration={duration}
        timelineContainerRef={timelineContainerRef}
        selectedSchedule={selectedSchedule}
        isDetailOpen={isDetailOpen}
        setIsDetailOpen={setIsDetailOpen}
        handleSelectSchedule={handleSelectSchedule}
        handleAssignVehicle={handleAssignVehicle}
        handleSelfArranged={async (id) => {
          try {
            const schedule = scheduleData.schedules.find(s => s.id === id);
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
                title: 'Lịch trình đã duyệt — Tự túc phương tiện',
                content: `Lịch trình "${schedule.title}" đã được duyệt. Phương tiện do các bạn tự sắp xếp.`,
                link: '/dashboard/schedule',
              }]);
            }
            notifySuccess('Đã duyệt — tự túc phương tiện');
            setIsDetailOpen(false);
            refetchLegacy();
          } catch (error) {
            notifyError(error, 'Không duyệt được');
          }
        }}
        handleUpdateEndTime={handleUpdateEndTime}
        handleUpdateSchedule={handleUpdateSchedule}
      />
    );
  }

  // Default view cho admin/director/manager/staff thường — KHÔNG fetch legacy schedule.
  return <DefaultDashboardView profile={profile} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
