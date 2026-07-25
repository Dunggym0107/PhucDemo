'use client'

import React from "react";
import { format } from "date-fns";
import { filterBGD, filterStaff, resolveParticipantIds, checkConflicts, checkResourceConflicts, checkDeputyDirectorLimit } from "../_lib/utils";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { canCoordinateSharedResources } from "@/lib/permissions";

interface UseScheduleDetailProps {
  isOpen: boolean;
  schedule: any;
  schedules: any[];
  vehicles: any[];
  rooms: any[];
  allProfiles: any[];
  currentProfile: any;
  onAssignVehicle: (scheduleId: string, vehicleId: string | null, driverId: string | null) => void;
  onUpdateEndTime: (scheduleId: string, newEndTime: string) => void;
  onUpdateSchedule: (scheduleId: string, updates: any) => void;
  onResubmitSchedule?: (scheduleId: string, changeReason: string, editedPayload: any) => void;
}

export function useScheduleDetail({
  isOpen, schedule, schedules, vehicles, rooms, allProfiles, currentProfile,
  onAssignVehicle, onUpdateEndTime, onUpdateSchedule, onResubmitSchedule
}: UseScheduleDetailProps) {
  // --- Trạng thái chỉnh sửa ---
  const [isEditingTime, setIsEditingTime] = React.useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = React.useState(false);
  const [editMode, setEditMode] = React.useState<'edit' | 'resubmit'>('edit');
  const [changeReason, setChangeReason] = React.useState("");
  const [newEndTime, setNewEndTime] = React.useState("");
  const [editData, setEditData] = React.useState<any>({});

  // --- Trạng thái điều phối xe ---
  const [tempVehicleId, setTempVehicleId] = React.useState<string | null>(null);
  const [tempDriverId, setTempDriverId] = React.useState<string | null>(null);

  // --- Trạng thái chọn ngày giờ khi sửa ---
  const [editStartDate, setEditStartDate] = React.useState<Date | undefined>(undefined);
  const [editEndDate, setEditEndDate] = React.useState<Date | undefined>(undefined);
  const [editStartTime, setEditStartTime] = React.useState<string>("08:00");
  const [editEndTime, setEditEndTime] = React.useState<string>("09:00");
  const [isStartOpen, setIsStartOpen] = React.useState(false);
  const [isEndOpen, setIsEndOpen] = React.useState(false);

  // --- Trạng thái chọn thành phần tham gia ---
  const [bgdMode, setBgdMode] = React.useState<'all' | 'specific' | 'none'>('specific');
  const [selectedBGD, setSelectedBGD] = React.useState<string[]>([]);
  const [deptMode, setDeptMode] = React.useState<'all' | 'specific' | 'none'>('specific');
  const [filterDepts, setFilterDepts] = React.useState<string[]>([]);
  const [participantMode, setParticipantMode] = React.useState<'all' | 'manager' | 'staff'>('staff');
  const [selectedParticipants, setSelectedParticipants] = React.useState<string[]>([]);

  // --- Đồng bộ dữ liệu khi mở Dialog ---
  React.useEffect(() => {
    if (schedule?.end_time && isOpen) {
      setNewEndTime(format(new Date(schedule.end_time), "yyyy-MM-dd'T'HH:mm"));
      setIsEditingTime(false);
      setIsEditingSchedule(false);
      setEditMode('edit');
      setChangeReason("");
      setTempVehicleId(schedule.vehicle_id || null);
      setTempDriverId(schedule.driver_id || null);

      const existingIds = (schedule.participants || []).map((p: any) => p.profile?.id).filter(Boolean);
      const bgdProfiles = filterBGD(allProfiles);
      const bgdIds = bgdProfiles.filter(p => existingIds.includes(p.id)).map(p => p.id);
      const otherIds = existingIds.filter((id: string) => !bgdProfiles.some(bp => bp.id === id));
      const activeDepts = Array.from(new Set(allProfiles.filter(p => otherIds.includes(p.id)).map(p => p.department_id).filter(Boolean)));

      setBgdMode(bgdIds.length > 0 ? 'specific' : 'none');
      setSelectedBGD(bgdIds);
      setDeptMode(otherIds.length > 0 ? 'specific' : 'none');
      setFilterDepts(activeDepts.length > 0 ? activeDepts : (currentProfile?.department_id ? [currentProfile.department_id] : []));
      setParticipantMode('staff');
      setSelectedParticipants(otherIds);

      const start = new Date(schedule.start_time);
      const end = new Date(schedule.end_time);
      setEditStartDate(start);
      setEditEndDate(end);
      setEditStartTime(format(start, "HH:mm"));
      setEditEndTime(format(end, "HH:mm"));

      setEditData({
        title: schedule.title || "",
        description: schedule.description || "",
        type: schedule.type || "trip",
        start_time: format(start, "yyyy-MM-dd'T'HH:mm"),
        end_time: format(end, "yyyy-MM-dd'T'HH:mm"),
        location: schedule.location || "",
        destinations: schedule.metadata?.destinations || [{ location: schedule.location || "" }],
        room_id: schedule.room_id || "none",
        use_vehicle: !!schedule.use_vehicle,
        vehicle_id: schedule.vehicle_id || "none",
        requested_vehicle_type: schedule.requested_vehicle_type || null,
      });
    }
  }, [schedule, isOpen]);

  // --- Kiểm tra xung đột lịch trình (realtime) ---
  const conflicts = React.useMemo(() => {
    if (!editStartDate || !editEndDate || editData.type === 'leave') return [];

    const startString = `${format(editStartDate, 'yyyy-MM-dd')}T${editStartTime}`;
    const endString = `${format(editEndDate, 'yyyy-MM-dd')}T${editEndTime}`;
    let start: Date;
    let end: Date;
    try {
      start = new Date(startString);
      end = new Date(endString);
    } catch {
      return [];
    }

    const finalParticipantIds = resolveParticipantIds({ selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode, allProfiles });

    const pConflicts = checkConflicts({
      checkIds: finalParticipantIds,
      startDate: editStartDate,
      endDate: editEndDate,
      startTime: editStartTime,
      endTime: editEndTime,
      schedules,
      ignoreScheduleId: schedule?.id
    });

    const rConflicts = checkResourceConflicts({
      roomId: editData.location === 'Chi nhánh' && editData.room_id !== 'none' ? editData.room_id : null,
      vehicleId: editData.use_vehicle && editData.vehicle_id !== 'none' ? editData.vehicle_id : null,
      start,
      end,
      schedules,
      ignoreScheduleId: schedule?.id
    });

    // Giới hạn số Phó giám đốc
    const bdgProfileIds = allProfiles
      .filter((p: any) => finalParticipantIds.includes(p.id))
      .filter((p: any) =>
        p.role === 'director' || p.title?.toLowerCase().includes('giám đốc')
      )
      .map((p: any) => p.id);

    const deputyWarnings = checkDeputyDirectorLimit({
      bdgProfileIds,
      startDate: editStartDate,
      endDate: editEndDate,
      startTime: editStartTime,
      endTime: editEndTime,
      schedules,
      allProfiles,
      ignoreScheduleId: schedule?.id,
    });

    return [...pConflicts, ...rConflicts, ...deputyWarnings];
  }, [editStartDate, editEndDate, editStartTime, editEndTime, selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode, allProfiles, schedules, editData.location, editData.room_id, editData.use_vehicle, editData.vehicle_id, editData.type, schedule?.id]);

  // --- Tính toán phái sinh ---
  const matchedVehicle = schedule ? vehicles.find(v => v.id === schedule.vehicle_id) : null;

  const headerBgMap: any = {
    meeting: "bg-orange-50/80",
    trip: "bg-orange-50/80",
    event: "bg-amber-50/80",
    leave: "bg-slate-100/80",
  };
  const badgeColorMap: any = {
    meeting: "text-orange-700 border-orange-200/50",
    trip: "text-orange-700 border-orange-200/50",
    event: "text-amber-700 border-amber-200/50",
    leave: "text-slate-700 border-slate-200/50",
  };
  const headerBg = schedule ? (headerBgMap[schedule.type] || "bg-slate-50/80") : "bg-slate-50/80";
  const badgeColor = schedule ? (badgeColorMap[schedule.type] || "text-slate-700 border-slate-200/50") : "";

  // --- Kiểm tra quyền ---
  const isParticipant = schedule?.participants?.some((p: any) => p.profile?.id === currentProfile?.id);
  const isCreator = schedule?.created_by === currentProfile?.id;
  const isLeave = schedule?.type === 'leave';
  const canCoord = canCoordinateSharedResources(currentProfile);

  const openEditMode = (mode: 'edit' | 'resubmit' = 'edit') => {
    setEditMode(mode);
    setChangeReason("");
    setIsEditingSchedule(true);
  };

  // --- Hàm xử lý ---
  const handleSaveTime = async () => {
    if (!newEndTime || !schedule) return;
    const ok = await confirmDialog({
      title: 'Thay đổi giờ kết thúc?',
      description: 'Tất cả người tham gia sẽ nhận được thông báo cập nhật thời gian.',
      confirmText: 'Lưu thay đổi',
    });
    if (ok) {
      onUpdateEndTime(schedule.id, new Date(newEndTime).toISOString());
      setIsEditingTime(false);
    }
  };

  const handleEndNow = async () => {
    if (!schedule) return;
    const ok = await confirmDialog({
      title: 'Kết thúc lịch trình ngay?',
      description: 'Tài nguyên (xe/phòng) sẽ được giải phóng và thông báo cho người tham gia.',
      confirmText: 'Kết thúc ngay',
      danger: true,
    });
    if (ok) {
      onUpdateEndTime(schedule.id, new Date().toISOString());
      setIsEditingTime(false);
    }
  };

  const handleSaveSchedule = () => {
    if (!schedule) return;
    const isLeaveType = editData.type === 'leave';
    const isBranchLocation = editData.location === 'Chi nhánh';

    if (!editData.title?.trim()) return;
    if (!isLeaveType && isBranchLocation && (!editData.room_id || editData.room_id === 'none')) return;
    if (!isLeaveType && !isBranchLocation && !editData.destinations?.some((d: any) => d.location?.trim())) return;

    if (editMode === 'resubmit' && changeReason.trim().length < 10) return;

    const finalParticipantIds = isLeaveType
      ? [currentProfile?.id].filter(Boolean)
      : resolveParticipantIds({ selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode, allProfiles });

    const startString = `${format(editStartDate || new Date(), 'yyyy-MM-dd')}T${editStartTime}`;
    const endString = `${format(editEndDate || editStartDate || new Date(), 'yyyy-MM-dd')}T${editEndTime || "23:59"}`;

    const finalLocation = (!isLeaveType && !isBranchLocation && editData.destinations?.length > 0)
      ? editData.destinations.map((d: any) => d.location).filter(Boolean).join(' ➔ ')
      : editData.location;

    const selectedVehicle = !isLeaveType && editData.use_vehicle && editData.vehicle_id !== 'none'
      ? vehicles.find((vehicle: any) => vehicle.id === editData.vehicle_id)
      : null;

    const payload = {
      title: editData.title,
      description: editData.description || null,
      type: editData.type,
      start_time: new Date(startString).toISOString(),
      end_time: new Date(endString).toISOString(),

      location: isLeaveType ? null : finalLocation,
      metadata: (!isLeaveType && !isBranchLocation) ? { ...schedule.metadata, destinations: editData.destinations } : schedule.metadata,
      room_id: !isLeaveType && isBranchLocation && editData.room_id !== 'none' ? editData.room_id : null,
      use_vehicle: !isLeaveType && !!editData.use_vehicle,
      vehicle_id: selectedVehicle ? selectedVehicle.id : null,
      driver_id: selectedVehicle?.driver_id || null,
      requested_vehicle_type: selectedVehicle ? selectedVehicle.type : null,
      participant_ids: finalParticipantIds
    };

    if (editMode === 'resubmit' && onResubmitSchedule) {
      onResubmitSchedule(schedule.id, changeReason.trim(), payload);
    } else {
      onUpdateSchedule(schedule.id, payload);
    }
  };

  const handleStartTimeChange = (v: string) => {
    setEditStartTime(v);
    const [h, m] = v.split(':');
    const endH = Math.min(parseInt(h) + 1, 23);
    if (!editEndTime) setEditEndTime(`${endH.toString().padStart(2, '0')}:${m}`);
  };

  const handleVehicleSelect = (v: string) => {
    setTempVehicleId(v);
    const selectedV = vehicles.find(x => x.id === v);
    if (selectedV?.driver_id) setTempDriverId(selectedV.driver_id);
  };

  const handleDriverSelect = (d: string) => {
    setTempDriverId(d);
    const matchedVehicle = vehicles.find(x => x.driver_id === d);
    if (matchedVehicle) setTempVehicleId(matchedVehicle.id);
  };

  return {
    // Trạng thái chỉnh sửa
    isEditingTime, setIsEditingTime,
    isEditingSchedule, setIsEditingSchedule,
    editMode, setEditMode, openEditMode,
    changeReason, setChangeReason,
    newEndTime, setNewEndTime,
    editData, setEditData,
    // Điều phối xe
    tempVehicleId, setTempVehicleId,
    tempDriverId, setTempDriverId,
    // Ngày giờ
    editStartDate, setEditStartDate,
    editEndDate, setEditEndDate,
    editStartTime, setEditStartTime,
    editEndTime, setEditEndTime,
    isStartOpen, setIsStartOpen,
    isEndOpen, setIsEndOpen,
    // Thành phần tham gia
    bgdMode, setBgdMode,
    selectedBGD, setSelectedBGD,
    deptMode, setDeptMode,
    filterDepts, setFilterDepts,
    participantMode, setParticipantMode,
    selectedParticipants, setSelectedParticipants,
    // Tính toán phái sinh
    conflicts, matchedVehicle, headerBg, badgeColor,
    isParticipant, isCreator, isLeave, canCoord,
    // Hàm xử lý
    handleSaveTime, handleEndNow, handleSaveSchedule,
    handleStartTimeChange, handleVehicleSelect, handleDriverSelect,
  };
}
