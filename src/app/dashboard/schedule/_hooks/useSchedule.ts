import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { addDays, endOfDay, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { resolveParticipantIds, checkConflicts, checkResourceConflicts, checkDeputyDirectorLimit } from "../_lib/utils";
import { canApproveLeave, canCoordinateSharedResources, canUseDriverWorkspace } from "@/lib/permissions";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { createSchedule as createScheduleHelper } from "../_lib/createSchedule";
import { updateScheduleAction } from "../_lib/updateSchedule";
import { fetchScheduleData } from "../_lib/fetchScheduleData";
import { useAppData } from "@/hooks/use-app-data";
import { HOUR_START, HOUR_END, HOUR_RANGE } from "../_lib/constants";

export function useSchedule() {
  const supabase = createClient();
  const { toast } = useToast();
  // Profiles/departments/vehicles/rooms/currentProfile lấy từ AppDataProvider — không fetch lại
  const {
    currentProfile,
    profiles: cachedProfiles,
    departments: cachedDepartments,
    vehicles: cachedVehicles,
    rooms: cachedRooms,
  } = useAppData();
  // allProfiles của schedule cũ loại admin để giữ shape consumer
  const allProfiles = useMemo(() => cachedProfiles.filter((p: any) => p.role !== 'admin'), [cachedProfiles]);
  const profile = currentProfile;
  const departments = cachedDepartments;
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Auto-open create dialog khi navigated with ?type=leave (e.g. from HR dashboard) hoặc ?create=1 (FAB mobile)
  useEffect(() => {
    const typeParam = searchParams.get('type');
    const createParam = searchParams.get('create');
    let shouldUpdateUrl = false;
    const params = new URLSearchParams(searchParams.toString());

    if (typeParam === 'leave') {
      setNewSchedule((prev: any) => ({ ...prev, type: 'leave' }));
      setIsCreateOpen(true);
      params.delete('type');
      shouldUpdateUrl = true;
    } else if (createParam === '1') {
      setIsCreateOpen(true);
      params.delete('create');
      shouldUpdateUrl = true;
    }

    if (shouldUpdateUrl) {
      router.replace(`${pathname}?${params.toString()}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, pathname, router]);

  // Dữ liệu chính — schedules fetch riêng theo window; vehicles/rooms lấy từ provider.
  const [schedules, setSchedules] = useState<any[]>([]);
  const vehicles = cachedVehicles;
  const rooms = cachedRooms;
  const [loading, setLoading] = useState(true);

  // State điều hướng
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterType, setFilterType] = useState<'all' | 'bgd' | 'dept'>(canCoordinateSharedResources(profile) ? 'all' : 'bgd');

  // State dialog tạo mới
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState<any>({
    title: "", description: "", location: "", department_id: "",
    type: "trip", use_room: false, room_id: "",
    use_vehicle: true, vehicle_id: "none", requested_vehicle_type: null, participants: [],
    target_profile_id: "", destinations: [{ location: "" }]
  });
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("");
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);

  // State chọn thành phần tham gia
  const [bgdMode, setBgdMode] = useState<'all' | 'specific' | 'none'>('none');
  const [selectedBGD, setSelectedBGD] = useState<string[]>([]);
  const [deptMode, setDeptMode] = useState<'all' | 'specific' | 'none'>('none');
  const [filterDepts, setFilterDepts] = useState<string[]>([]);
  const [participantMode, setParticipantMode] = useState<'all' | 'manager' | 'staff'>('staff');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  // State dialog chi tiết
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Tính toán
  const defaultTab = canUseDriverWorkspace(profile) ? 'driver-trips' : 'calendar';
  const pendingVehicleCount = schedules.filter(s => s.use_vehicle && s.status === 'pending').length;
  const pendingVehicleBadge = pendingVehicleCount > 9 ? "9+" : pendingVehicleCount;
  const canCoordinateResources = canCoordinateSharedResources(profile);

  // Đếm số đơn nghỉ phép chờ duyệt theo phân cấp lãnh đạo
  const getPendingLeavesCount = () => {
    if (!profile) return 0;
    return schedules.filter(s => {
      if (s.type !== 'leave' || s.status !== 'pending') return false;
      return canApproveLeave(profile, s);
    }).length;
  };

  const pendingLeavesCount = getPendingLeavesCount();
  const pendingLeavesBadge = pendingLeavesCount > 9 ? "9+" : pendingLeavesCount;

  const getDepartmentName = (user: any) => {
    const dept = user?.departments;
    return Array.isArray(dept) ? dept[0]?.name : dept?.name;
  };

  const isScheduleApprover = (user: any) => canCoordinateSharedResources(user);

  const sendNotifications = async (rows: any[]) => {
    const uniqueRows = rows.filter((row, index, arr) =>
      row?.user_id && arr.findIndex(item =>
        item.user_id === row.user_id &&
        item.title === row.title &&
        item.content === row.content &&
        item.link === row.link
      ) === index
    );
    if (uniqueRows.length === 0) return;

    const { error } = await supabase.from('notifications').insert(uniqueRows);
    if (error) {
      console.error('Notification insert failed:', error);
      notifyError(error, "Không gửi được thông báo cho người tham gia");
    }
  };

  const weekDays = eachDayOfInterval({
    start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
    end: endOfWeek(selectedDate, { weekStartsOn: 1 })
  });

  const isTodaySelected = isSameDay(selectedDate, new Date());
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startLimit = HOUR_START * 60;
  const endLimit = HOUR_END * 60;
  const duration = endLimit - startLimit;
  const isWithinWorkingHours = currentMinutes >= startLimit && currentMinutes <= endLimit;
  const currentTimePercent = isWithinWorkingHours ? ((currentMinutes - startLimit) / duration) * 100 : -1;

  // Kiểm tra xung đột lịch
  const conflicts = useMemo(() => {
    if (!startDate || !endDate) return [];
    const checkIds = resolveParticipantIds({
      selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode, allProfiles
    });
    const finalCheckIds = Array.from(new Set([profile?.id, ...checkIds].filter(Boolean))) as string[];

    // Xung đột thời gian cá nhân
    const timeConflicts = checkConflicts({ checkIds: finalCheckIds, startDate, endDate, startTime, endTime, schedules });

    // Giới hạn số Phó giám đốc
    const bdgProfileIds = allProfiles
      .filter((p: any) => finalCheckIds.includes(p.id))
      .filter((p: any) =>
        p.role === 'director' || p.title?.toLowerCase().includes('giám đốc')
      )
      .map((p: any) => p.id);

    const deputyWarnings = checkDeputyDirectorLimit({
      bdgProfileIds,
      startDate, endDate, startTime, endTime,
      schedules, allProfiles,
    });

    return [...timeConflicts, ...deputyWarnings];
  }, [startDate, endDate, startTime, endTime, selectedParticipants, selectedBGD, bgdMode, deptMode, participantMode, allProfiles, schedules, filterDepts, profile?.id]);

  const resourceConflicts = useMemo(() => {
    if (!startDate || !endDate || newSchedule.type === 'leave') return [];
    const start = new Date(startDate);
    const [sHour, sMin] = startTime.split(':');
    start.setHours(parseInt(sHour), parseInt(sMin));
    const end = new Date(endDate);
    const [eHour, eMin] = endTime.split(':');
    end.setHours(parseInt(eHour), parseInt(eMin));

    return checkResourceConflicts({
      roomId: newSchedule.location === 'Chi nhánh' ? newSchedule.room_id : null,
      start,
      end,
      schedules
    });
  }, [startDate, endDate, startTime, endTime, newSchedule.type, newSchedule.location, newSchedule.room_id, schedules]);

  useEffect(() => {
    if (profile?.department_id && filterDepts.length === 0) {
      setFilterDepts([profile.department_id]);
    }
  }, [profile?.department_id, filterDepts.length]);

  // Auto-scroll timeline khi chọn tab BGĐ
  useEffect(() => {
    if (filterType === 'bgd' && timelineContainerRef.current) {
      setTimeout(() => {
        if (!timelineContainerRef.current) return;
        const containerWidth = timelineContainerRef.current.scrollWidth;
        const clientWidth = timelineContainerRef.current.clientWidth;

        if (isTodaySelected) {
          // Hôm nay: cuộn đến khung giờ hiện tại
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          if (currentMinutes >= startLimit && currentMinutes <= endLimit) {
            const totalMinutes = duration;
            const minutesElapsed = currentMinutes - startLimit;
            const percentElapsed = minutesElapsed / totalMinutes;
            const scrollTarget = containerWidth * percentElapsed - clientWidth / 2;
            timelineContainerRef.current.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
          }
        } else {
          // Ngày khác: cuộn về đầu ngày (05:00)
          timelineContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }
      }, 300);
    }
  }, [filterType, loading, isTodaySelected]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchScheduleData(supabase, selectedDate, profile);
      if (profile?.department_id && filterDepts.length === 0) {
        setFilterDepts([profile.department_id]);
      }
      setSchedules(result.schedules);
    } catch (error) {
      notifyError(error, "Không tải được dữ liệu lịch trình");
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedDate, profile, filterDepts.length]);

  const fetchDataRef = useRef(fetchData);
  useEffect(() => {
    fetchDataRef.current = fetchData;
  });

  // Fetch dữ liệu khi selectedDate thay đổi
  useEffect(() => {
    setMounted(true);
    fetchData();
  }, [selectedDate, fetchData]);

  // Đăng ký kênh Real-time đồng bộ một lần duy nhất khi mount
  useEffect(() => {
    let refetchTimer: any = null;
    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => {
        fetchDataRef.current();
      }, 600);
    };

    // Realtime narrowing: tách INSERT/UPDATE/DELETE — tránh '*' (bao gồm TRUNCATE).
    // vehicles/rooms đã được AppDataProvider subscribe → bỏ khỏi channel này.
    const channel = supabase
      .channel('schedule_realtime_sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'schedules' }, scheduleRefetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'schedules' }, scheduleRefetch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'schedules' }, scheduleRefetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'schedule_participants' }, scheduleRefetch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'schedule_participants' }, scheduleRefetch)
      .subscribe();

    return () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const findParticipantConflicts = async (params: {
    participantIds: string[];
    start: Date;
    end: Date;
    ignoreScheduleId?: string;
  }) => {
    const participantIds = Array.from(new Set(params.participantIds.filter(Boolean)));
    if (participantIds.length === 0) return [];

    const { data: rpcData, error: rpcError } = await supabase.rpc('check_schedule_participant_conflicts', {
      p_participant_ids: participantIds,
      p_start: params.start.toISOString(),
      p_end: params.end.toISOString(),
      p_ignore_schedule_id: params.ignoreScheduleId || null
    });

    if (!rpcError && rpcData) {
      return rpcData.map((row: any) => {
        const sStart = new Date(row.start_time).toLocaleString('vi-VN');
        const sEnd = new Date(row.end_time).toLocaleString('vi-VN');
        const suffix = row.status === 'pending' ? ' (Chờ duyệt)' : '';
        return `${row.full_name || 'Người tham gia'} đang bận${suffix}: ${row.title} (${sStart} - ${sEnd})`;
      });
    }

    if (rpcError) {
      console.warn('Conflict RPC unavailable, falling back to RLS-limited query:', rpcError);
    }

    const { data, error } = await supabase
      .from('schedules')
      .select(`id, title, start_time, end_time, status, participants:schedule_participants(profile:profiles(id, full_name))`)
      .neq('status', 'rejected')
      .lt('start_time', params.end.toISOString())
      .gt('end_time', params.start.toISOString());

    if (error) throw error;

    return (data || []).flatMap((schedule: any) => {
      if (schedule.id === params.ignoreScheduleId) return [];

      return (schedule.participants || [])
        .filter((participant: any) => participantIds.includes(participant.profile?.id))
        .map((participant: any) => {
          const sStart = new Date(schedule.start_time).toLocaleString('vi-VN');
          const sEnd = new Date(schedule.end_time).toLocaleString('vi-VN');
          const suffix = schedule.status === 'pending' ? ' (Chờ duyệt)' : '';
          return `${participant.profile?.full_name || 'Người tham gia'} đang bận${suffix}: ${schedule.title} (${sStart} - ${sEnd})`;
        });
    });
  };

  // Handlers
  const handleStatusUpdate = async (id: string, status: string, reason?: string) => {
    try {
      const schedule = schedules.find(s => s.id === id);
      if (status === 'approved' && schedule?.use_vehicle && !schedule?.vehicle_id) {
        notifyValidation(
          "Lịch trình có yêu cầu xe phải được điều phối xe trước khi duyệt.",
          "Cần gán xe trước"
        );
        return;
      }

      const updatePayload: any = { status };
      if (status === 'rejected') {
        updatePayload.rejection_reason = reason ?? null;
        updatePayload.rejected_by = profile?.id ?? null;
        updatePayload.rejected_at = new Date().toISOString();
      } else if (status === 'approved') {
        updatePayload.rejection_reason = null;
        updatePayload.rejected_by = null;
        updatePayload.rejected_at = null;
      }

      const { error } = await supabase.from('schedules').update(updatePayload).eq('id', id);
      if (error) throw error;
      if (schedule?.created_by && schedule.created_by !== profile?.id) {
        await sendNotifications([{
          user_id: schedule.created_by,
          title: status === 'approved' ? "Lịch trình Đã Duyệt" : "Lịch trình Từ Chối",
          content: status === 'approved'
            ? `Lịch trình "${schedule.title}" đã được phê duyệt.`
            : `Lịch trình "${schedule.title}" bị từ chối. Lý do: ${reason || 'Không có lý do.'}`,
          link: "/dashboard/schedule"
        }]);
      }
      notifySuccess(
        status === 'approved' ? "Đã duyệt lịch trình" : "Đã từ chối lịch trình"
      );
      fetchData();
    } catch (error) {
      notifyError(error, "Không cập nhật được trạng thái lịch trình");
    }
  };

  // Creator đẩy lại lịch đã bị từ chối — kèm "Lý do thay đổi" gửi cho bộ phận điều phối.
  const handleResubmitSchedule = async (id: string, changeReason: string, editedPayload: any) => {
    try {
      const schedule = schedules.find(s => s.id === id);
      if (!schedule) return;

      const payload = {
        ...editedPayload,
        status: 'pending',
        change_reason: changeReason,
        rejection_reason: null,
        rejected_by: null,
        rejected_at: null,
      };

      await updateScheduleAction({
        supabase, toast, profile, allProfiles, schedules, id, updates: payload,
        findParticipantConflicts, sendNotifications, setIsDetailOpen, fetchData,
      });

      // Fan-out notification cho danh sách approver (admin + secretary + manager phòng điều phối)
      const approverIds = allProfiles
        .filter((p: any) => {
          if (p.role === 'admin' || p.role === 'secretary') return true;
          if (p.role !== 'manager') return false;
          const dept = Array.isArray(p.departments) ? p.departments[0] : p.departments;
          return dept?.code === '13602' || dept?.name === 'Tổ chức Tổng hợp';
        })
        .map((p: any) => p.id)
        .filter((uid: string) => uid && uid !== profile?.id);

      if (approverIds.length > 0) {
        await sendNotifications(
          approverIds.map((uid: string) => ({
            user_id: uid,
            title: "Lịch trình được gửi lại duyệt",
            content: `Lịch "${editedPayload.title || schedule.title}" đã được chỉnh sửa và gửi lại để duyệt. Lý do thay đổi: ${changeReason}`,
            link: "/dashboard/schedule"
          }))
        );
      }
    } catch (error) {
      notifyError(error, "Không đẩy lại được lịch trình");
    }
  };

  const handleAssignVehicle = async (scheduleId: string, vehicleId: string | null, driverId: string | null = null) => {
    try {
      const schedule = schedules.find(s => s.id === scheduleId);
      const { error } = await supabase.from('schedules').update({ 
        vehicle_id: vehicleId, 
        driver_id: driverId,
        status: vehicleId ? 'approved' : 'pending' 
      }).eq('id', scheduleId);
      
      if (error) throw error;
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (schedule?.created_by) {
        await sendNotifications([{
          user_id: schedule.created_by,
          title: vehicleId ? "Xác nhận điều phối phương tiện" : "Hủy điều phối phương tiện",
          content: vehicleId
            ? `Bộ phận điều phối đã bố trí phương tiện ${vehicle?.plate_number} (${vehicle?.name}) cho chuyến công tác "${schedule.title}". Lịch trình đã được phê duyệt.`
            : `Phương tiện cho chuyến công tác "${schedule.title}" đã bị hủy do thay đổi kế hoạch điều phối. Vui lòng kiểm tra lại.`,
          link: "/dashboard/schedule"
        }]);
      }
      
      // Gửi thông báo cho Lái xe
      if (driverId) {
        await sendNotifications([{
          user_id: driverId,
          title: "Thông báo điều động Lái xe",
          content: `Bạn vừa được phân công phụ trách chuyến công tác "${schedule.title}" với xe ${vehicle?.plate_number}. Vui lòng kiểm tra lịch trình để chuẩn bị.`,
          link: "/dashboard/schedule"
        }]);
      } else if (schedule?.driver_id && !driverId) {
        await sendNotifications([{
          user_id: schedule.driver_id,
          title: "Hủy phân công Lái xe",
          content: `Phân công của bạn cho chuyến công tác "${schedule.title}" đã được thu hồi do thay đổi kế hoạch điều phối.`,
          link: "/dashboard/schedule"
        }]);
      }

      // Loại trừ driver khỏi thông báo cập nhật lịch chung (quy tắc §5.D.2)
      const participantIds = (schedule?.participants || [])
        .filter((p: any) => p.profile?.role !== 'driver')
        .map((p: any) => p.profile?.id)
        .filter((uid: string) => uid && uid !== profile?.id && uid !== schedule?.created_by);
        
      if (vehicleId && participantIds.length > 0) {
        await sendNotifications(
          participantIds.map((uid: string) => ({
            user_id: uid,
            title: "Thông báo lịch trình công tác",
            content: `Chuyến công tác "${schedule.title}" đã được bộ phận điều phối xác nhận và bố trí phương tiện. Vui lòng theo dõi lịch trình.`,
            link: "/dashboard/schedule"
          }))
        );
      }
      
      notifySuccess(vehicleId ? "Đã gán xe và tài xế cho lịch trình" : "Đã huỷ gán xe");
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setIsDetailOpen(false);
      fetchData();
    } catch (error) {
      notifyError(error, "Không gán được xe");
    }
  };
  const handleDeleteSchedule = async (id: string) => {
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) throw error;
      notifySuccess("Đã xóa lịch trình");
      setIsDetailOpen(false);
      fetchData();
    } catch (error) {
      notifyError(error, "Không xóa được lịch trình");
    }
  };

  const handleUpdateEndTime = async (id: string, newEndTimeStr: string) => {
    try {
      // Get current schedule to compare and notify
      const schedule = schedules.find(s => s.id === id);
      if (!schedule) return;
      
      const newEndTime = new Date(newEndTimeStr);
      const isEndEarly = newEndTime <= new Date();
      const newStatus = isEndEarly
        ? 'completed'
        : schedule.status === 'completed'
          ? 'in_progress'
          : schedule.status;

      const updatePayload: any = { 
        end_time: newEndTime.toISOString(),
        status: newStatus,
      };
      // Ghi nhận thời gian kết thúc thực tế để timeline BGĐ hiển thị đúng
      if (newStatus === 'completed') {
        updatePayload.metadata = {
          ...(schedule.metadata || {}),
          trip_ended_at: newEndTime.toISOString(),
        };
      }

      const { error } = await supabase.from('schedules').update(updatePayload).eq('id', id);
      if (error) throw error;

      // Ghi nhận lịch sử / cảnh báo cho những người khác (thông báo) — loại trừ lái xe
      if (schedule.participants?.length > 0) {
        const otherParticipantIds = schedule.participants
          .filter((p: any) => p.profile?.id !== profile?.id && p.profile?.role !== 'driver')
          .map((p: any) => p.profile?.id)
          .filter(Boolean);
        
        if (otherParticipantIds.length > 0) {
          const isCompletion = newStatus === 'completed' && schedule.status === 'in_progress';
          await sendNotifications(
            otherParticipantIds.map((uid: string) => ({
              user_id: uid,
              title: isCompletion ? "Lịch trình đã kết thúc" : "Lịch trình thay đổi thời gian",
              content: isCompletion
                ? `${profile?.full_name || 'Người điều phối'} đã kết thúc lịch trình "${schedule.title}" lúc ${String(newEndTime.getHours()).padStart(2, '0')}:${String(newEndTime.getMinutes()).padStart(2, '0')} ${String(newEndTime.getDate()).padStart(2, '0')}/${String(newEndTime.getMonth() + 1).padStart(2, '0')}.`
                : `${profile?.full_name || 'Người điều phối'} đã cập nhật thời gian kết thúc của "${schedule.title}" thành ${String(newEndTime.getHours()).padStart(2, '0')}:${String(newEndTime.getMinutes()).padStart(2, '0')} ${String(newEndTime.getDate()).padStart(2, '0')}/${String(newEndTime.getMonth() + 1).padStart(2, '0')}.`,
              link: "/dashboard/schedule"
            }))
          );
        }
      }

      notifySuccess("Đã cập nhật thời gian kết thúc");
      fetchData();
    } catch (error) {
      notifyError(error, "Không cập nhật được thời gian kết thúc");
    }
  };

  const handleUpdateSchedule = async (id: string, updates: any) => {
    await updateScheduleAction({
      supabase, toast, profile, allProfiles, schedules, id, updates,
      findParticipantConflicts, sendNotifications, setIsDetailOpen, fetchData,
    });
  };


  const resetCreateForm = () => {
    setNewSchedule({ title: "", description: "", location: "", department_id: "", type: "trip", use_room: false, room_id: "", use_vehicle: true, vehicle_id: "none", requested_vehicle_type: null, participants: [], target_profile_id: "", destinations: [{ location: "" }] });
    setStartDate(new Date());
    setEndDate(new Date());
    setStartTime("08:00");
    setEndTime("09:00");
    setBgdMode('none');
    setSelectedBGD([]);
    setDeptMode('none');
    setFilterDepts(profile?.department_id ? [profile.department_id] : []);
    setParticipantMode('staff');
    setSelectedParticipants([]);
    setIsCreateOpen(false);
  };

  const handleCreateSchedule = async () => {
    if (!startDate) {
      notifyValidation("Vui lòng chọn ngày bắt đầu.");
      return;
    }
    // Tự động gán ngày kết thúc và giờ kết thúc nếu người dùng không chọn
    const finalEndDate = endDate ? endDate : new Date(startDate);
    const finalEndTime = endTime ? endTime : "23:59";

    await createScheduleHelper({
      supabase, toast, profile, allProfiles, newSchedule,
      startDate, endDate: finalEndDate, startTime, endTime: finalEndTime,
      conflicts, resourceConflicts,
      selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode,
      findParticipantConflicts, sendNotifications, isScheduleApprover,
      resetForm: resetCreateForm,
      fetchData,
    });
  };

  const handleSelectSchedule = (s: any) => {
    setSelectedSchedule(s);
    setIsDetailOpen(true);
  };

  return {
    schedules, vehicles, rooms, loading, profile, allProfiles, departments,
    selectedDate, setSelectedDate, filterType, setFilterType,
    isCreateOpen, setIsCreateOpen, newSchedule, setNewSchedule,
    startDate, setStartDate, endDate, setEndDate, startTime, setStartTime, endTime, setEndTime,
    isStartOpen, setIsStartOpen, isEndOpen, setIsEndOpen,
    bgdMode, setBgdMode, selectedBGD, setSelectedBGD,
    deptMode, setDeptMode, filterDepts, setFilterDepts,
    participantMode, setParticipantMode, selectedParticipants, setSelectedParticipants,
    selectedSchedule, setSelectedSchedule, isDetailOpen, setIsDetailOpen,
    timelineContainerRef, mounted, setMounted, searchParams,
    toast, supabase, defaultTab, pendingVehicleCount, pendingVehicleBadge,
    canCoordinateResources, getPendingLeavesCount, pendingLeavesCount, pendingLeavesBadge,
    getDepartmentName, isScheduleApprover, sendNotifications, weekDays, isTodaySelected,
    now, currentMinutes, startLimit, endLimit, duration, isWithinWorkingHours, currentTimePercent,
    conflicts, resourceConflicts, fetchData, findParticipantConflicts,
    handleStatusUpdate, handleAssignVehicle, handleDeleteSchedule, handleUpdateEndTime, handleUpdateSchedule, handleResubmitSchedule, handleCreateSchedule, handleSelectSchedule
  };
}
