// Helper cập nhật lịch trình hiện có — tách khỏi useSchedule để giữ file gốc dưới 500 dòng.

import { checkResourceConflicts } from "./utils";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { toast } from "@/hooks/use-toast";

interface UpdateScheduleParams {
  supabase: any;
  toast: any;                                                     // legacy — giữ signature, không dùng nội bộ
  profile: any;
  allProfiles: any[];
  schedules: any[];
  id: string;
  updates: any;
  findParticipantConflicts: (params: { participantIds: string[]; start: Date; end: Date; ignoreScheduleId?: string }) => Promise<string[]>;
  sendNotifications: (rows: any[]) => Promise<void>;
  setIsDetailOpen: (v: boolean) => void;
  fetchData: () => Promise<void>;
}

export async function updateScheduleAction(p: UpdateScheduleParams) {
  const {
    supabase, profile, allProfiles, schedules, id, updates,
    findParticipantConflicts, sendNotifications, setIsDetailOpen, fetchData,
  } = p;

  try {
    const schedule = schedules.find((s: any) => s.id === id);
    if (!schedule) return;

    const nextStart = updates.start_time ? new Date(updates.start_time) : new Date(schedule.start_time);
    const nextEnd = updates.end_time ? new Date(updates.end_time) : new Date(schedule.end_time);
    if (nextEnd <= nextStart) {
      notifyValidation("Thời gian kết thúc phải sau thời gian bắt đầu.", "Lỗi thời gian");
      return;
    }

    const isLeave = (updates.type || schedule.type) === 'leave';

    const resourceErrors = isLeave ? [] : checkResourceConflicts({
      roomId: updates.room_id,
      vehicleId: updates.vehicle_id,
      start: nextStart,
      end: nextEnd,
      schedules,
      ignoreScheduleId: id
    });

    if (resourceErrors.length > 0) {
      notifyValidation(resourceErrors[0], "Tài nguyên đang bận");
      return;
    }

    const { participant_ids, ...scheduleUpdates } = updates;
    const nextParticipantIds = Array.isArray(participant_ids)
      ? Array.from(new Set([schedule.created_by, ...participant_ids].filter(Boolean)))
      : (schedule.participants || []).map((q: any) => q.profile?.id).filter(Boolean);

    // Nếu schedule đã completed mà end_time được chuyển về tương lai → tự set in_progress
    if (schedule.status === 'completed' && updates.end_time && new Date(updates.end_time) > new Date()) {
      scheduleUpdates.status = 'in_progress';
    }
    // Nếu schedule chuyển thành completed → ghi trip_ended_at
    if (scheduleUpdates.status === 'completed') {
      scheduleUpdates.metadata = {
        ...(schedule.metadata || {}),
        trip_ended_at: new Date().toISOString(),
      };
    }
    const participantConflicts = isLeave ? [] : await findParticipantConflicts({
      participantIds: nextParticipantIds,
      start: nextStart,
      end: nextEnd,
      ignoreScheduleId: id
    });

    const { error } = await supabase.from('schedules').update(scheduleUpdates).eq('id', id);
    if (error) throw error;

    const oldParticipantIds = (schedule.participants || [])
      .map((q: any) => q.profile?.id)
      .filter(Boolean);
    let finalParticipantIds = oldParticipantIds;
    let addedParticipantIds: string[] = [];

    if (Array.isArray(participant_ids)) {
      finalParticipantIds = Array.from(new Set([schedule.created_by, ...participant_ids].filter(Boolean)));
      addedParticipantIds = finalParticipantIds.filter((uid: string) => !oldParticipantIds.includes(uid));
      const removedParticipantIds = oldParticipantIds.filter((uid: string) => !finalParticipantIds.includes(uid));

      if (removedParticipantIds.length > 0) {
        const { error: deleteError } = await supabase.from('schedule_participants')
          .delete()
          .eq('schedule_id', id)
          .in('profile_id', removedParticipantIds);
        if (deleteError) throw deleteError;
      }

      if (addedParticipantIds.length > 0) {
        const { error: insertError } = await supabase.from('schedule_participants').insert(
          addedParticipantIds.map((uid: string) => ({ schedule_id: id, profile_id: uid }))
        );
        if (insertError) throw insertError;
      }
    }

    // Loại trừ lái xe khỏi thông báo cập nhật lịch chung
    const notifyTargets = finalParticipantIds.filter((uid: string) => {
      if (!uid || uid === profile?.id) return false;
      const target = allProfiles.find((x: any) => x.id === uid);
      return target?.role !== 'driver';
    });

    if (notifyTargets.length > 0) {
      await sendNotifications(
        notifyTargets.map((uid: string) => ({
          user_id: uid,
          title: addedParticipantIds.includes(uid) ? "Bạn được thêm vào lịch trình" : `Lịch trình đã được cập nhật`,
          content: addedParticipantIds.includes(uid)
            ? `${profile?.full_name || 'Người dùng'} đã thêm bạn vào lịch trình "${scheduleUpdates.title || schedule.title}".`
            : `${profile?.full_name || 'Người dùng'} đã cập nhật lịch trình "${scheduleUpdates.title || schedule.title}".`,
          link: "/dashboard/schedule"
        }))
      );
    }

    if (participantConflicts.length > 0) {
      // Cảnh báo (không phải lỗi) — vẫn dùng toast trực tiếp vì không có helper "warning"
      toast({ title: "Cảnh báo trùng lịch", description: participantConflicts[0] });
    } else {
      notifySuccess("Đã cập nhật lịch trình");
    }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setIsDetailOpen(false);
    fetchData();
  } catch (error) {
    notifyError(error, "Không cập nhật được lịch trình");
  }
}
