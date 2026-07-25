// Types cho dashboard default view (admin/director/manager/staff).
// Match shape JSON trả về từ RPC dashboard_summary().

export interface DashboardCounts {
  active: number;
  urgent: number;
  overdue: number;
  done_today: number;
}

export interface TodayTaskItem {
  id: string;
  title: string;
  status: 'todo' | 'doing' | 'submitted';
  priority: 'low' | 'medium' | 'high' | null;
  due_date: string | null;
  is_overdue: boolean;
}

export interface PendingDocCategory {
  id: string;
  name: string;
  sla_hours: number | null;
  color: string | null;
}

export interface PendingDocHandover {
  id: string;
  document_id: string;
  sender_id: string | null;
  receiver_id: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | string;
  sent_at: string | null;
  received_at: string | null;
}

export interface PendingDocItem {
  id: string;
  short_code: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  current_assignee_id: string | null;
  creator_id: string | null;
  category: PendingDocCategory | null;
  handovers: PendingDocHandover[] | null;
}

export interface TodayLeaveItem {
  id: string;
  type: string;
  status: string;
  start_time: string;
  end_time: string;
  created_by: string;
}

export interface DashboardSummary {
  counts: DashboardCounts;
  today_tasks: TodayTaskItem[];
  pending_docs: PendingDocItem[];
  today_leaves: TodayLeaveItem[];
  role: string;
}
