// Hook detail 1 task — fetch + realtime subscribe theo channel `task_<id>`.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { fetchTaskDetail } from '../_lib/fetchTasks';
import type { TaskDetail } from '../_lib/types';

export function useTaskDetail(taskId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskDetail | null>(null);

  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    if (!taskId) return;
    const detail = await fetchTaskDetail(taskId);
    setTask(detail);
  }, [taskId]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(refetch, 250);
  }, [refetch]);

  useEffect(() => {
    if (!taskId) {
      setLoading(false);
      setTask(null);
      return;
    }
    let active = true;
    (async () => {
      setLoading(true);
      const detail = await fetchTaskDetail(taskId);
      if (!active) return;
      setTask(detail);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    const channel = supabase
      .channel(`task_${taskId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `id=eq.${taskId}` },
        scheduleRefetch,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` },
        scheduleRefetch,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_assignees', filter: `task_id=eq.${taskId}` },
        scheduleRefetch,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_extension_requests', filter: `task_id=eq.${taskId}` },
        scheduleRefetch,
      )
      .subscribe();
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, taskId, scheduleRefetch]);

  return { loading, task, refetch };
}
