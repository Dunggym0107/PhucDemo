'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export interface AnalyticsTotals {
  completed: number;
  overdue: number;
  submitted_pending: number;
  extensions_pending: number;
  total: number;
  canceled: number;
}
export interface DailyPoint { date: string; count: number }
export interface DeptStat {
  dept_id: string;
  dept_name: string;
  active: number;
  overdue: number;
  completed: number;
}
export interface PersonStat {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  department_name: string | null;
  active: number;
  overdue: number;
  completed: number;
}
export interface AnalyticsResult {
  totals: AnalyticsTotals;
  daily_completed: DailyPoint[];
  by_department: DeptStat[];
  top_people: PersonStat[];
  top_overdue_people: PersonStat[];
  resource_view: ResourceViewItem[];
  recurring_active: number;
  role: string;
  scope_dept: string | null;
  from: string;
  to: string;
}

export interface ResourceViewItem {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  active_count: number;
  overdue_count: number;
}

export function useTaskAnalytics(
  fromDate: Date,
  toDate: Date,
  deptId: string | null,
  enabled = true,
) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fromStr = fromDate.toISOString().slice(0, 10);
  const toStr = toDate.toISOString().slice(0, 10);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    const { data: res, error: rpcError } = await supabase.rpc('tasks_analytics', {
      p_from: fromStr,
      p_to: toStr,
      p_dept_id: deptId,
    } as any);
    setLoading(false);
    if (rpcError) {
      setError(rpcError.message);
      console.error('tasks_analytics error:', {
        message: rpcError.message,
        code: rpcError.code,
        details: rpcError.details,
        hint: rpcError.hint,
      });
      return;
    }
    setData(res as unknown as AnalyticsResult);
  }, [supabase, fromStr, toStr, deptId, enabled]);

  useEffect(() => { refetch(); }, [refetch]);

  return { loading, data, error, refetch };
}
