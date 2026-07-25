import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { notifyError } from "@/lib/notify";

// Hook fetch chi tiết 1 profile cho ProfileDetailDialog:
// - profile + departments
// - tasks tháng hiện tại (cho ProfileStatsSection — sửa label "tháng này" cho đúng)
// - recognitions nhận được
// - OOO active của target
export function useProfileDetail(targetId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<{
    target: any | null;
    monthlyTasks: any[];
    recognitions: any[];
    ooo: any | null;
  }>({ target: null, monthlyTasks: [], recognitions: [], ooo: null });
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!targetId) {
      setData({ target: null, monthlyTasks: [], recognitions: [], ooo: null });
      return;
    }
    setLoading(true);
    try {
      const { data: target, error: e1 } = await supabase
        .from('profiles')
        .select('*, departments (id, name, code)')
        .eq('id', targetId)
        .single();
      if (e1 || !target) throw e1 ?? new Error('Không tìm thấy hồ sơ');

      // Tasks THÁNG NÀY — assigned hoặc trong task_assignees, created_at >= đầu tháng
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [{ data: directTasks }, { data: assignments }] = await Promise.all([
        supabase.from('tasks').select('id').eq('assignee_id', targetId).gte('created_at', monthStart),
        supabase.from('task_assignees').select('task_id').eq('user_id', targetId),
      ]);
      const directIds = (directTasks ?? []).map((t: any) => t.id);
      const assigneeIds = (assignments ?? []).map((a: any) => a.task_id);
      const allIds = Array.from(new Set([...directIds, ...assigneeIds]));

      let monthlyTasks: any[] = [];
      if (allIds.length > 0) {
        const { data: fetched } = await supabase
          .from('tasks')
          .select('*')
          .in('id', allIds)
          .gte('created_at', monthStart)
          .order('created_at', { ascending: false });
        monthlyTasks = fetched ?? [];
      }

      // Recognitions nhận được — limit 20 mới nhất
      const { data: recogs } = await supabase
        .from('recognitions')
        .select('*, sender:profiles!recognitions_sender_id_fkey (id, full_name, avatar_url)')
        .eq('receiver_id', targetId)
        .order('created_at', { ascending: false })
        .limit(20);

      // OOO của target
      let ooo: any = null;
      try {
        const { data: o } = await supabase
          .from('out_of_office')
          .select('*')
          .eq('user_id', targetId)
          .gte('ends_at', now.toISOString())
          .maybeSingle();
        ooo = o ?? null;
      } catch {
        ooo = null;
      }

      setData({ target, monthlyTasks, recognitions: recogs ?? [], ooo });
    } catch (error) {
      notifyError(error, "Không tải được hồ sơ");
      setData({ target: null, monthlyTasks: [], recognitions: [], ooo: null });
    } finally {
      setLoading(false);
    }
  }, [supabase, targetId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { ...data, loading, refetch: fetchAll };
}
