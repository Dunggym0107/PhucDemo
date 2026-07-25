'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { RecurringTemplate } from '../_lib/recurringHelpers';

export function useRecurringTemplates(enabled = true) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RecurringTemplate[]>([]);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    const { data, error } = await supabase
      .from('task_recurring_templates')
      .select('*')
      .order('is_active', { ascending: false })
      .order('next_run_at', { ascending: true, nullsFirst: false });
    if (error) {
      console.error('fetchRecurring error:', error);
      return;
    }
    setItems((data ?? []) as RecurringTemplate[]);
  }, [supabase, enabled]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(refetch, 300);
  }, [refetch]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    (async () => {
      setLoading(true);
      await refetch();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [refetch, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel('recurring_templates_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_recurring_templates' }, scheduleRefetch)
      .subscribe();
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, scheduleRefetch, enabled]);

  return { loading, items, refetch };
}
