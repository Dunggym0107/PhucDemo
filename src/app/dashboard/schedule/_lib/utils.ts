import { directorColors } from "./constants";
import { format } from "date-fns";
import { sortProfilesByHierarchy } from "@/lib/utils";

// Lọc danh sách Ban Giám đốc (Sắp xếp đồng bộ: Cấp trưởng lên đầu -> Alphabet Việt)
export function filterBGD(profiles: any[]) {
  const filtered = profiles.filter(p =>
    (p.role === 'director' || p.title?.toLowerCase().includes('giám đốc') || p.full_name?.toLowerCase().includes('giám đốc')) &&
    !p.full_name?.toLowerCase().includes('admin') &&
    p.role !== 'admin'
  );

  return sortProfilesByHierarchy(filtered);
}

// Lọc nhân viên (không phải admin, director) - Sắp xếp đồng bộ: Manager -> Staff -> Cấp trưởng -> Alphabet Việt
export function filterStaff(profiles: any[]) {
  const filtered = profiles.filter(p =>
    p.role !== 'admin' &&
    p.role !== 'director' &&
    !p.full_name?.toLowerCase().includes('admin') &&
    !p.full_name?.toLowerCase().includes('giám đốc')
  );

  return sortProfilesByHierarchy(filtered);
}

// Gán màu cho từng thành viên BGĐ
export function getDirectorColor(fullName: string, allProfiles: any[]) {
  const name = fullName ? fullName.trim() : '';

  const bgdList = filterBGD(allProfiles).map(p => p.full_name);

  const index = bgdList.indexOf(fullName);
  if (index !== -1) {
    return directorColors[index % directorColors.length];
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return directorColors[Math.abs(hash) % directorColors.length];
}

// Tính toán danh sách ID người tham gia dựa trên lựa chọn
export function resolveParticipantIds(params: {
  selectedParticipants: string[];
  bgdMode: 'all' | 'specific' | 'none';
  selectedBGD: string[];
  deptMode: 'all' | 'specific' | 'none';
  filterDepts: string[];
  participantMode: 'all' | 'manager' | 'staff';
  allProfiles: any[];
}) {
  const { selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode, allProfiles } = params;

  let ids = [...selectedParticipants];

  // BGĐ
  if (bgdMode === 'all') {
    const bgdIds = filterBGD(allProfiles).map(p => p.id);
    ids = [...new Set([...ids, ...bgdIds])];
  } else if (bgdMode === 'specific') {
    ids = [...new Set([...ids, ...selectedBGD])];
  }

  // Đơn vị / Phòng
  if (deptMode === 'all') {
    const allStaffIds = allProfiles.filter(p => p.role !== 'admin' && p.role !== 'director').map(p => p.id);
    ids = [...new Set([...ids, ...allStaffIds])];
  } else if (deptMode === 'specific' && filterDepts.length > 0) {
    // Chỉ lấy theo phòng ban được chọn
    if (participantMode === 'all') {
      const deptIds = allProfiles.filter(p => filterDepts.includes(p.department_id)).map(p => p.id);
      ids = [...new Set([...ids, ...deptIds])];
    } else if (participantMode === 'manager') {
      const mgrIds = allProfiles.filter(p => filterDepts.includes(p.department_id) && (p.role === 'manager' || p.is_department_head === true)).map(p => p.id);
      ids = [...new Set([...ids, ...mgrIds])];
    }
    // participantMode = 'staff': không thêm lãnh đạo phòng
  }
  // deptMode = 'none' hoặc 'specific' mà chưa chọn phòng: không thêm ai

  return ids;
}

// Kiểm tra xung đột lịch trình
export function checkConflicts(params: {
  checkIds: string[];
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  schedules: any[];
  ignoreScheduleId?: string;
}) {
  const { checkIds, startDate, endDate, startTime, endTime, schedules, ignoreScheduleId } = params;

  if (checkIds.length === 0) return [];

  try {
    const startString = `${format(startDate, 'yyyy-MM-dd')}T${startTime}`;
    const endString = `${format(endDate, 'yyyy-MM-dd')}T${endTime}`;
    const start = new Date(startString);
    const end = new Date(endString);

    const foundConflicts: string[] = [];
    schedules.forEach(s => {
      if (s.id === ignoreScheduleId || s.status === 'rejected' || s.status === 'completed') return;
      const isPending = s.status === 'pending';
      const sStart = new Date(s.start_time);
      const sEnd = new Date(s.end_time);

      const isOverlapping = (start < sEnd && end > sStart);

      if (isOverlapping) {
        s.participants?.forEach((p: any) => {
          if (checkIds.includes(p.profile?.id)) {
            foundConflicts.push(`${p.profile?.full_name} đang bận${isPending ? ' (Chờ duyệt)' : ''}: ${s.title} (${format(sStart, 'HH:mm')} - ${format(sEnd, 'HH:mm')})`);
          }
        });
      }
    });
    return Array.from(new Set(foundConflicts));
  } catch (e) {
    console.warn('checkConflicts error:', e);
    return [];
  }
}

export function checkResourceConflicts(params: {
  roomId?: string | null;
  vehicleId?: string | null;
  start: Date;
  end: Date;
  schedules: any[];
  ignoreScheduleId?: string;
}) {
  const { roomId, vehicleId, start, end, schedules, ignoreScheduleId } = params;
  const conflicts: string[] = [];

  schedules.forEach(s => {
    if (s.id === ignoreScheduleId || s.status === 'rejected' || s.status === 'completed') return;

    const sStart = new Date(s.start_time);
    const sEnd = new Date(s.end_time);
    const isOverlapping = start < sEnd && end > sStart;
    if (!isOverlapping) return;

    if (roomId && roomId !== 'none' && s.room_id === roomId) {
      conflicts.push(`Phòng họp đang bận: ${s.title} (${format(sStart, 'HH:mm')} - ${format(sEnd, 'HH:mm')})`);
    }
  });

  return Array.from(new Set(conflicts));
}

/**
 * Kiểm tra giới hạn số lượng Phó giám đốc đi công tác cùng lúc.
 * Chỉ tính các lịch khiến PGĐ vắng mặt tại chi nhánh (trip, leave, 
 * meeting/event có xe hoặc địa điểm ngoài chi nhánh).
 * Meeting tại chi nhánh không tính vì PGĐ vẫn trực được.
 * Tối đa (tổng PGĐ - 1) được phép vắng cùng thời điểm.
 * Giám đốc (is_department_head = true) được miễn trừ.
 * Ai đăng ký trước được trước, ai đăng ký sau phải nhận cảnh báo.
 */
export function checkDeputyDirectorLimit(params: {
  bdgProfileIds: string[];        // danh sách BGĐ được chọn làm participant
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  schedules: any[];
  allProfiles: any[];
  ignoreScheduleId?: string;
  isEdit?: boolean;
}): string[] {
  const { bdgProfileIds, startDate, endDate, startTime, endTime, schedules, allProfiles, ignoreScheduleId, isEdit } = params;

  if (bdgProfileIds.length === 0) return [];
  const today = new Date();

  // Tìm Giám đốc (is_department_head = true trong số BGĐ)
  const giamDocId = allProfiles.find((p: any) =>
    (p.role === 'director' || p.title?.toLowerCase().includes('giám đốc')) &&
    p.is_department_head === true &&
    !p.full_name?.toLowerCase().includes('admin')
  )?.id;

  // Lấy tất cả Phó giám đốc trong hệ thống (không chỉ những người được chọn)
  const allPhoIds = allProfiles
    .filter((p: any) =>
      (p.role === 'director' || p.title?.toLowerCase().includes('giám đốc')) &&
      p.id !== giamDocId &&
      !p.full_name?.toLowerCase().includes('admin')
    )
    .map((p: any) => p.id);

  if (allPhoIds.length === 0) return [];

  try {
    const startString = `${format(startDate, 'yyyy-MM-dd')}T${startTime}`;
    const endString = `${format(endDate, 'yyyy-MM-dd')}T${endTime}`;
    const newStart = new Date(startString);
    const newEnd = new Date(endString);

    // Đếm Phó giám đốc đã có lịch overlap trong khung giờ này
    const busyPhoSet = new Set<string>();
    const busyNamesList: string[] = [];

    const isAbsent = (s: any) => {
      // Chỉ tính là vắng mặt (không trực được) nếu PGĐ thực sự rời chi nhánh
      if (s.type === 'trip') return true;               // công tác → vắng
      if (s.type === 'leave') return true;               // nghỉ phép → vắng
      // meeting/event: vắng nếu có xe hoặc địa điểm ngoài chi nhánh
      if (s.type === 'meeting' || s.type === 'event') {
        if (s.use_vehicle) return true;                  // có xe → đi ngoài
        if (s.location && s.location !== 'Chi nhánh') return true;  // địa điểm ngoài
        return false;                                    // họp tại chi nhánh → vẫn trực được
      }
      return true; // mặc định tính vắng nếu không xác định được
    };

    schedules.forEach((s: any) => {
      if (s.id === ignoreScheduleId || s.status === 'rejected' || s.status === 'completed') return;

      const sStart = new Date(s.start_time);
      const sEnd = new Date(s.end_time);
      const isOverlapping = newStart < sEnd && newEnd > sStart;
      if (!isOverlapping) return;

      // Chỉ đếm PGĐ nếu lịch đó thực sự khiến họ vắng mặt tại chi nhánh
      if (!isAbsent(s)) return;

      (s.participants || []).forEach((p: any) => {
        const pid = p.profile?.id;
        if (pid && allPhoIds.includes(pid)) {
          busyPhoSet.add(pid);
        }
      });
    });

    // Lấy tên PGĐ đã bận
    busyPhoSet.forEach((pid) => {
      const profile = allProfiles.find((p: any) => p.id === pid);
      if (profile) busyNamesList.push(profile.full_name);
    });

    // Lọc PGĐ được chọn tham gia lịch mới (loại Giám đốc)
    const selectedPhoIds = bdgProfileIds.filter((id: string) => id !== giamDocId);

    // Tổng số PGĐ sẽ bận = PGĐ đã bận + PGĐ mới được thêm (không tính trùng)
    const allBusyAfter = new Set([...busyPhoSet, ...selectedPhoIds]);

    // Luôn để 1 Phó giám đốc ở lại trực
    const maxPhoCanGo = Math.max(0, allPhoIds.length - 1);

    const warnings: string[] = [];
    if (allBusyAfter.size > maxPhoCanGo) {
      const busyList = busyNamesList.length > 0 ? ` (${busyNamesList.join(', ')})` : '';
      warnings.push(
        `Hiện có ${busyPhoSet.size} Phó giám đốc đã có lịch trong khung giờ này${busyList}. ` +
        `Theo quy định, phải để ít nhất 1 Phó giám đốc ở lại trực (tối đa ${maxPhoCanGo}/${allPhoIds.length} được đi). ` +
        `Vui lòng cân nhắc điều chỉnh thành phần tham gia.`
      );
    }

    return warnings;
  } catch (e) {
    console.warn('checkDeputyDirectorLimit error:', e);
    return [];
  }
}
