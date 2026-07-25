'use client';

// Hook gọi RPC dashboard_summary() — gộp 13 round-trip cũ về 1.
// Realtime hẹp: chỉ subscribe tasks + documents + document_handovers (3 bảng).
// In-memory cache 30s: tránh gọi lại RPC khi user switch tab > quay lại (SPA).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { DashboardSummary, DashboardCounts } from '../_lib/types';

const EMPTY_COUNTS: DashboardCounts = {
  active: 0,
  urgent: 0,
  overdue: 0,
  done_today: 0,
};

const EMPTY_DATA: DashboardSummary = {
  counts: EMPTY_COUNTS,
  today_tasks: [],
  pending_docs: [],
  today_leaves: [],
  role: 'staff',
};

// In-memory cache 30s — module-level, shared giữa các lần mount hook.
// Khi cache còn hạn, trả về ngay mà không cần gọi RPC.
// Khi realtime fire hoặc cache hết hạn → gọi RPC + cập nhật cache.
const CACHE_TTL_MS = 30_000;
let cachedData: { data: DashboardSummary; at: number } | null = null;

export interface UseDashboardSummaryOptions {
  enabled?: boolean;
}

export function useDashboardSummary(opts: UseDashboardSummaryOptions = {}) {
  const supabase = useMemo(() => createClient(), []);
  const enabled = opts.enabled ?? true;

  const hasValidCache = useMemo(() => {
    return !!(cachedData && Date.now() - cachedData.at < CACHE_TTL_MS);
  }, []);

  const [loading, setLoading] = useState(!hasValidCache);
  const [data, setData] = useState<DashboardSummary>(() => {
    // Hydrate từ cache ngay lần render đầu — perceived instant
    if (cachedData && Date.now() - cachedData.at < CACHE_TTL_MS) {
      return cachedData.data;
    }
    return EMPTY_DATA;
  });

  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!enabled) return;
    
    // Cache hit: nếu cache còn hạn (dưới 30s), không gọi RPC
    if (cachedData && Date.now() - cachedData.at < CACHE_TTL_MS) {
      setData(cachedData.data);
      return;
    }

    const { data: res, error } = await supabase.rpc('dashboard_summary');
    if (error) {
      // Log đầy đủ vì PostgrestError không stringify mặc định
      console.error('dashboard_summary error:', error.message, error.code, error.details, error.hint);
      return;
    }
    const r = res as unknown as DashboardSummary;
    const summary: DashboardSummary = {
      counts: r?.counts ?? EMPTY_COUNTS,
      today_tasks: r?.today_tasks ?? [],
      pending_docs: r?.pending_docs ?? [],
      today_leaves: r?.today_leaves ?? [],
      role: r?.role ?? 'staff',
    };
    // Ghi cache + state
    cachedData = { data: summary, at: Date.now() };
    setData(summary);
  }, [supabase, enabled]);

  const refetch = useCallback(async () => {
    // Force refetch: clear cache rồi gọi lại
    cachedData = null;
    await fetchSummary();
  }, [fetchSummary]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(fetchSummary, 300);
  }, [fetchSummary]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    (async () => {
      if (!hasValidCache) {
        setLoading(true);
      }
      await fetchSummary();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [fetchSummary, enabled, hasValidCache]);

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel('dashboard_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_handovers' }, scheduleRefetch)
      .subscribe();
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, scheduleRefetch, enabled]);

  return { loading, data, refetch };
}
