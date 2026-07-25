import { createClient } from '@/utils/supabase/client';
import type { ActionResult, TaskPriority } from './types';
import type { ScheduleKind } from './recurringHelpers';

const supabase = createClient();

export interface UpsertTemplateInput {
  id?: string | null;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  target_department_ids: string[];
  target_user_ids: string[];
  schedule_kind: ScheduleKind;
  weekly_dow?: number | null;
  weekly_time?: string | null;
  monthly_dom?: number | null;
  monthly_time?: string | null;
  timezone?: string;
  due_days_after_fire?: number;
  due_time?: string;
  is_active?: boolean;
}

export async function upsertRecurringTemplate(input: UpsertTemplateInput): Promise<ActionResult<string>> {
  const { data, error } = await supabase.rpc('recurring_template_upsert', {
    p_id: input.id ?? null,
    p_title: input.title,
    p_description: input.description ?? null,
    p_priority: input.priority,
    p_target_department_ids: input.target_department_ids,
    p_target_user_ids: input.target_user_ids,
    p_schedule_kind: input.schedule_kind,
    p_weekly_dow: input.weekly_dow ?? null,
    p_weekly_time: input.weekly_time ?? null,
    p_monthly_dom: input.monthly_dom ?? null,
    p_monthly_time: input.monthly_time ?? null,
    p_timezone: input.timezone ?? 'Asia/Ho_Chi_Minh',
    p_due_days_after_fire: input.due_days_after_fire ?? 7,
    p_due_time: input.due_time ?? '17:00',
    p_is_active: input.is_active ?? true,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as string };
}

export async function deleteRecurringTemplate(id: string): Promise<ActionResult> {
  const { error } = await supabase.rpc('recurring_template_delete', { p_id: id } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function toggleRecurringTemplate(id: string, active: boolean): Promise<ActionResult> {
  const { error } = await supabase.rpc('recurring_template_toggle', {
    p_id: id, p_active: active,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function forceRunRecurringTemplate(id: string): Promise<ActionResult> {
  const { error } = await supabase.rpc('recurring_template_force_run', { p_id: id } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
