// Helper fetch dữ liệu lịch trình — tách khỏi useSchedule để giữ file gốc dưới 500 dòng.
// Profiles/departments/vehicles/rooms KHÔNG còn fetch ở đây — caller bơm vào từ AppDataProvider cache.
//
// Tối ưu Supabase queries (Gói D):
//   Trước đây gộp schedulesQuery + pendingQueueQuery là 2 SELECT nặng trùng lặp,
//   client merge dedupe → tốn ~2x payload.
//   Bây giờ: 1 SELECT với điều kiện OR (window tuần) hoặc (use_vehicle pending)
//   — PostgREST xử lý dedupe ở DB, giảm payload + 1 round-trip.

import { addDays, endOfDay, endOfWeek, startOfWeek } from "date-fns";
import { canCoordinateSharedResources } from "@/lib/permissions";

const SCHEDULE_SELECT = `*, metadata, creator:profiles!schedules_created_by_fkey(full_name, title, avatar_url, department_id, role, is_department_head), room:rooms(name), vehicle:vehicles(name, plate_number), driver:profiles!schedules_driver_id_fkey(id, full_name, title, phone), rejecter:profiles!schedules_rejected_by_fkey(id, full_name, title), participants:schedule_participants(profile:profiles(id, full_name, title, avatar_url, role, is_department_head))`;

export interface FetchedScheduleData {
  schedules: any[];
}

export async function fetchScheduleData(
  supabase: any,
  selectedDate: Date,
  currentProfile: any
): Promise<FetchedScheduleData> {
  // Fallback dọn trạng thái: lịch họp/sự kiện/nghỉ phép không xe tự completed sau end_time + 15 phút.
  // Ignore lỗi để UI vẫn tải được nếu migration RPC chưa được deploy kịp.
  try {
    const { error } = await supabase.rpc('complete_finished_schedules');
    if (error) throw error;
  } catch (error) {
    console.warn('Schedule auto-complete skipped:', error);
  }

  const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const end = new Date(Math.max(
    endOfWeek(selectedDate, { weekStartsOn: 1 }).getTime(),
    endOfDay(addDays(selectedDate, 3)).getTime()
  ));

  const canSeePendingQueue = canCoordinateSharedResources(currentProfile);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  // 1 SELECT duy nhất. Coordinator chỉ được thêm queue lịch cần xe (có thể ngoài window).
  // RLS vẫn là nguồn chặn cuối: điều phối không thấy lịch không xe ngoài phòng/participant.
  let query = supabase
    .from('schedules')
    .select(SCHEDULE_SELECT)
    .order('start_time');

  if (canSeePendingQueue) {
    query = query.or(
      `and(end_time.gte.${startIso},start_time.lte.${endIso}),and(use_vehicle.eq.true,status.eq.pending)`
    );
  } else {
    query = query.gte('end_time', startIso).lte('start_time', endIso);
  }

  const { data: scheds, error: sError } = await query;
  if (sError) throw sError;

  let allSchedules = scheds || [];

  // ⭐ Luôn lấy thêm lịch mà user là tài xế được gán (bất kể tuần nào),
  // để tài xế luôn thấy chuyến được giao dù lịch ở tuần sau.
  if (currentProfile?.id) {
    const { data: driverScheds } = await supabase
      .from('schedules')
      .select(SCHEDULE_SELECT)
      .eq('driver_id', currentProfile.id)
      .neq('status', 'rejected')
      .order('start_time');

    if (driverScheds) {
      const existingIds = new Set(allSchedules.map((s: any) => s.id));
      for (const ds of driverScheds) {
        if (!existingIds.has(ds.id)) {
          allSchedules.push(ds);
        }
      }
      allSchedules.sort(
        (a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
    }
  }

  return { schedules: allSchedules };
}
