// Helper tạo lịch trình mới — tách khỏi useSchedule để giữ file gốc dưới 500 dòng.
// Nhận state đã được chuẩn hoá và trả về Promise<void>.

import { resolveParticipantIds } from "./utils";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";

interface CreateScheduleParams {
  supabase: any;
  toast: any;                                                     // legacy — không dùng nội bộ, giữ để không phá signature
  profile: any;
  allProfiles: any[];

  newSchedule: any;
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  conflicts: string[];
  resourceConflicts: string[];
  selectedParticipants: string[];
  bgdMode: 'all' | 'specific' | 'none';
  selectedBGD: string[];
  deptMode: 'all' | 'specific' | 'none';
  filterDepts: string[];
  participantMode: 'all' | 'manager' | 'staff';
  findParticipantConflicts: (params: { participantIds: string[]; start: Date; end: Date; ignoreScheduleId?: string }) => Promise<string[]>;
  sendNotifications: (rows: any[]) => Promise<void>;
  isScheduleApprover: (user: any) => boolean;
  resetForm: () => void;
  fetchData: () => Promise<void>;
}

export async function createSchedule(p: CreateScheduleParams) {
  const {
    supabase, profile, allProfiles, newSchedule,
    startDate, endDate, startTime, endTime,
    conflicts, resourceConflicts,
    selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode,
    findParticipantConflicts, sendNotifications, isScheduleApprover,
    resetForm, fetchData,
  } = p;

  if (!newSchedule.title || !startDate || !endDate) {
    notifyValidation("Vui lòng điền đầy đủ thông tin bắt buộc.");
    return;
  }
  const start = new Date(startDate);
  const [sHour, sMin] = startTime.split(':');
  start.setHours(parseInt(sHour), parseInt(sMin));
  const end = new Date(endDate);
  const [eHour, eMin] = endTime.split(':');
  end.setHours(parseInt(eHour), parseInt(eMin));

  const isLeave = newSchedule.type === 'leave';

  if (end <= start) {
    notifyValidation("Thời gian kết thúc phải sau thời gian bắt đầu.", "Lỗi thời gian");
    return;
  }
  if (!isLeave && newSchedule.location === 'Chi nhánh' && (!newSchedule.room_id || newSchedule.room_id === 'none')) {
    notifyValidation("Vui lòng chọn phòng họp tại chi nhánh.", "Thiếu phòng họp");
    return;
  }
  if (!isLeave && newSchedule.location !== 'Chi nhánh' && (!newSchedule.destinations || !newSchedule.destinations[0]?.location?.trim())) {
    notifyValidation("Vui lòng nhập địa điểm hoặc lộ trình cụ thể.", "Thiếu địa điểm");
    return;
  }
  if (!isLeave && resourceConflicts.length > 0) {
    notifyValidation(resourceConflicts[0], "Tài nguyên đang bận");
    return;
  }

  try {
    const { use_vehicle, participants, vehicle_id, target_profile_id, destinations, location: originLocation, ...insertData } = newSchedule;
    const targetId = (isLeave && newSchedule.target_profile_id) ? newSchedule.target_profile_id : profile?.id;
    const targetProfile = isLeave ? allProfiles.find((x: any) => x.id === targetId) : profile;

    const finalLocation = (!isLeave && originLocation !== 'Chi nhánh' && destinations?.length > 0)
      ? destinations.map((d: any) => d.location).filter(Boolean).join(' ➔ ')
      : originLocation;

    const selectedParticipantIds = isLeave
      ? [targetId].filter(Boolean)
      : resolveParticipantIds({ selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode, allProfiles });
    const finalParticipants = isLeave
      ? [targetId].filter(Boolean)
      : Array.from(new Set([profile?.id, ...selectedParticipantIds].filter(Boolean)));

    // Không chặn bằng popup — inline banner + ConflictWarningPopup đã đủ

    const hasDirectorParticipant = !isLeave && finalParticipants.some((uid: string) => {
      const participant = allProfiles.find((x: any) => x.id === uid);
      return participant?.role === 'director';
    });

    const isTargetBGD = targetProfile?.role === 'director' || targetProfile?.role === 'admin';
    // Chỉ admin/secretary được tự duyệt khi tạo lịch. HR Officer chỉ tạo hộ nhưng không tự duyệt.
    const isAuthorizedCreator = ['admin', 'secretary'].includes(profile?.role);
    const shouldApproveImmediately = isLeave
      ? (isTargetBGD || isAuthorizedCreator)
      : (!newSchedule.use_vehicle && !hasDirectorParticipant);
    const status = shouldApproveImmediately ? 'approved' : 'pending';

    // department_id: với đơn nghỉ phép đăng ký hộ, luôn ưu tiên phòng ban của người được nghỉ.
    // Tránh trường hợp HR/Thư ký đăng ký hộ BGĐ khiến lịch nhảy vào phòng của HR.
    const finalDepartmentId = isLeave
      ? (targetProfile?.department_id ?? null)
      : (targetProfile?.department_id || profile?.department_id);

    const { data: createdSchedule, error } = await supabase.from('schedules').insert({
      ...insertData,
      location: isLeave ? null : finalLocation,
      metadata: (!isLeave && originLocation !== 'Chi nhánh') ? { destinations } : {},
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      room_id: (!isLeave && newSchedule.location === 'Chi nhánh' && newSchedule.room_id !== "none") ? newSchedule.room_id : null,
      vehicle_id: null,
      driver_id: null,
      requested_vehicle_type: null,
      use_vehicle: !isLeave && use_vehicle,
      created_by: profile?.id,
      department_id: finalDepartmentId,
      status
    }).select().single();
    if (error) throw error;

    if (finalParticipants.length > 0) {
      const { error: insertError } = await supabase.from('schedule_participants').insert(
        finalParticipants.map((pid: string) => ({ schedule_id: createdSchedule.id, profile_id: pid }))
      );
      if (insertError) throw insertError;
    }

    if (createdSchedule.status === 'pending') {
      const notifyTargets = isLeave
        ? allProfiles.filter((q: any) => {
            if (q.id === profile?.id) return false;
            const isCreatorManager = profile?.role === 'manager' || profile?.is_department_head === true;
            // Đơn của Trưởng phòng/Lãnh đạo: BGĐ duyệt
            if (isCreatorManager) {
              return q.role === 'admin' || q.role === 'director';
            }
            // Đơn của cán bộ thường: Trưởng phòng/Lãnh đạo cùng phòng duyệt
            if (q.department_id === profile?.department_id && (q.role === 'manager' || q.is_department_head === true)) {
              return true;
            }
            // Admin luôn nhận để giám sát
            if (q.role === 'admin') return true;
            return false;
          })
        : allProfiles.filter(isScheduleApprover);

      if (notifyTargets.length > 0) {
        await sendNotifications(
          notifyTargets.map((user: any) => ({
            user_id: user.id,
            title: isLeave ? "Đơn xin nghỉ phép mới" : "Yêu cầu lịch trình mới",
            content: isLeave
              ? `${profile?.full_name} xin nghỉ phép: ${newSchedule.title}. Vui lòng phê duyệt.`
              : `${profile?.full_name} đã đăng ký lịch: ${newSchedule.title}. Vui lòng kiểm tra và xử lý.`,
            link: "/dashboard/schedule"
          }))
        );
      }
    }

    // Loại trừ lái xe khỏi thông báo lịch chung
    const participantNotifyTargets = finalParticipants.filter((uid: string) => {
      if (uid === profile?.id) return false;
      const target = allProfiles.find((x: any) => x.id === uid);
      return target?.role !== 'driver';
    });
    if (participantNotifyTargets.length > 0) {
      await sendNotifications(
        participantNotifyTargets.map((uid: string) => ({
          user_id: uid,
          title: createdSchedule.status === 'approved' ? "Lịch trình mới" : "Lịch trình đang chờ duyệt",
          content: `${profile?.full_name} đã thêm bạn vào lịch trình "${newSchedule.title}" từ ${start.toLocaleString('vi-VN')} đến ${end.toLocaleString('vi-VN')}.`,
          link: "/dashboard/schedule"
        }))
      );
    }

    notifySuccess(
      isLeave ? "Đã gửi đơn nghỉ phép" : "Đã đăng ký lịch trình",
      isLeave ? "Đợi cấp trên phê duyệt." : undefined
    );
    resetForm();
    fetchData();
  } catch (error) {
    notifyError(error, "Không tạo được lịch trình");
  }
}
