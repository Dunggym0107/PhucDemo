import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { notifyError } from "@/lib/notify";
import { sortProfilesByHierarchy } from "@/lib/utils";
import { useAppData } from "@/hooks/use-app-data";

// Hook chính cho /dashboard/team — profile/profiles/OOO lấy từ AppDataProvider
// (cache shared). Chỉ schedules-hôm-nay fetch riêng vì là dữ liệu query-specific.
// Realtime channel team_schedules_sync chỉ subscribe schedules (profiles/ooo đã
// được provider subscribe sẵn).
export function useTeamDirectory() {
  const supabase = useMemo(() => createClient(), []);
  const { profiles, currentProfile, outOfOffice, hydrating, refresh } = useAppData();
  const [todaySchedules, setTodaySchedules] = useState<any[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(true);

  const fetchSchedules = useCallback(async () => {
    try {
      const now = new Date();
      const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
      const { data, error } = await supabase
        .from('schedules')
        .select('id, type, status, created_by, start_time, end_time, schedule_participants(profile_id)')
        .in('status', ['approved', 'in_progress'])
        .lte('start_time', endOfDay.toISOString())
        .gte('end_time', startOfDay.toISOString());
      if (error) throw error;
      setTodaySchedules(data || []);
    } catch (error) {
      notifyError(error, "Không tải được lịch hôm nay");
    } finally {
      setSchedulesLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSchedules();

    let refetchTimer: any = null;
    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => fetchSchedules(), 600);
    };

    const channel = supabase
      .channel('team_schedules_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, scheduleRefetch)
      .subscribe();

    return () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchSchedules, supabase]);

  // Người thường ẩn admin khỏi danh bạ; admin xem được tất cả (debug)
  const members = useMemo(() => {
    const list = currentProfile?.role === 'admin'
      ? profiles
      : profiles.filter((p) => p.role !== 'admin');
    return sortProfilesByHierarchy(list);
  }, [profiles, currentProfile?.role]);

  const oooByUser = useMemo(() => {
    const map = new Map<string, any>();
    Object.values(outOfOffice).forEach((o) => map.set(o.user_id, o));
    return map;
  }, [outOfOffice]);

  const loading = (hydrating && profiles.length === 0) || schedulesLoading;

  const refetch = useCallback(async () => {
    await Promise.all([refresh(), fetchSchedules()]);
  }, [refresh, fetchSchedules]);

  return { profile: currentProfile, members, todaySchedules, oooByUser, loading, refetch };
}
