export type ScheduleKind = 'weekly' | 'monthly';

export interface RecurringTemplate {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high';
  target_department_ids: string[];
  target_user_ids: string[];
  schedule_kind: ScheduleKind;
  weekly_dow: number | null;
  weekly_time: string | null;
  monthly_dom: number | null;
  monthly_time: string | null;
  timezone: string;
  due_days_after_fire: number;
  due_time: string;
  created_by: string | null;
  is_active: boolean;
  last_fired_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

const DOW_LABEL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export function formatScheduleHuman(t: Pick<
  RecurringTemplate,
  'schedule_kind' | 'weekly_dow' | 'weekly_time' | 'monthly_dom' | 'monthly_time'
>): string {
  if (t.schedule_kind === 'weekly') {
    if (t.weekly_dow === null || !t.weekly_time) return '—';
    return `Mỗi ${DOW_LABEL[t.weekly_dow]}, ${t.weekly_time.slice(0, 5)}`;
  }
  if (t.schedule_kind === 'monthly') {
    if (!t.monthly_dom || !t.monthly_time) return '—';
    return `Ngày ${t.monthly_dom} hằng tháng, ${t.monthly_time.slice(0, 5)}`;
  }
  return '—';
}

export const DOW_OPTIONS = DOW_LABEL.map((label, value) => ({ value, label }));
