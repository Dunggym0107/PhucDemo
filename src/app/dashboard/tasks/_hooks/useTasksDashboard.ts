'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type {
  TaskListItem,
  TasksDashboardResult,
  TaskScope,
  DashboardCounts,
  ResourceViewItem,
} from '../_lib/types';

export interface UseTasksDashboardOptions {
  scope?: TaskScope;
  enabled?: boolean;
}

const EMPTY_COUNTS: DashboardCounts = {
  todo: 0, doing: 0, submitted: 0, done: 0, canceled: 0,
  overdue: 0, awaiting_approval: 0, extensions_pending: 0,
};

export function useTasksDashboard(opts: UseTasksDashboardOptions = {}) {
  const supabase = useMemo(() => createClient(), []);
  const scope = opts.scope ?? 'mine';
  const enabled = opts.enabled ?? true;

  // loading = lần đầu (show skeleton). refreshing = tab switch (giữ data cũ, refresh ngầm)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [counts, setCounts] = useState<DashboardCounts>(EMPTY_COUNTS);
  const [items, setItems] = useState<TaskListItem[]>([]);
  const [resourceView, setResourceView] = useState<ResourceViewItem[]>([]);
  const [role, setRole] = useState<string>('staff');
  const [hasMore, setHasMore] = useState(false);

  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  const fetchPage = useCallback(async () => {
    if (!enabled) return;
    const seq = ++requestSeq.current;
    const { data, error } = await supabase.rpc('tasks_dashboard', {
      p_scope: scope,
    } as any);
    if (seq !== requestSeq.current) return;
    if (error) { console.error('tasks_dashboard error:', error?.message ?? error); setLoading(false); return; }
    const res = data as unknown as TasksDashboardResult;
    setCounts(res?.counts ?? EMPTY_COUNTS);
    const newItems = (res?.lists ?? []) as TaskListItem[];
    setItems(newItems);
    setResourceView((res?.resource_view ?? []) as ResourceViewItem[]);
    setRole(res?.role ?? 'staff');
    setHasMore(false);
  }, [supabase, scope, enabled]);

  const refetch = useCallback(async () => {
    await fetchPage();
  }, [fetchPage]);

  const loadMore = useCallback(async () => {}, []);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(refetch, 300);
  }, [refetch]);

  // Initial load + scope change. Một effect duy nhất để tránh gọi RPC 2 lần khi profile vừa sẵn sàng.
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    (async () => {
      if (items.length === 0) setLoading(true);
      else setRefreshing(true);
      await fetchPage();
      if (active) {
        setLoading(false);
        setRefreshing(false);
      }
    })().catch(() => {
      if (active) {
        setLoading(false);
        setRefreshing(false);
      }
    });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, enabled]);

  // Realtime chạy sau initial load để không tranh network với RPC đầu trang.
  useEffect(() => {
    if (!enabled || loading) return;
    const channel = supabase
      .channel('tasks_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, scheduleRefetch)
      .subscribe();
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, scheduleRefetch, enabled, loading]);

  return {
    loading,
    refreshing,
    loadingMore,
    counts,
    items,
    resourceView,
    role,
    refetch,
    loadMore,
    hasMore,
    scope,
  };
}
