// Type chung cho module Công việc. Lấy gốc từ database.types.ts + extend cho UI nhu cầu.
import type { TaskStatus, TaskPriority, ExtensionStatus, Tables } from '@/types/database.types';

export type { TaskStatus, TaskPriority, ExtensionStatus };

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

// Shape của 1 row trong list từ RPC tasks_dashboard
export interface TaskListItem {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  created_by: string | null;
  department_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, Json>;
  is_archived: boolean;
  requires_approval: boolean;
  batch_id: string | null;
  last_reminded_at: string | null;
  is_overdue: boolean;
  department: { id: string; name: string } | null;
  creator: { id: string; full_name: string | null; avatar_url: string | null; department_id?: string | null } | null;
  assignees: Array<{ id: string; full_name: string | null; avatar_url: string | null }> | null;
  _pending?: boolean;
}

export interface DashboardCounts {
  todo: number;
  doing: number;
  submitted: number;
  done: number;
  canceled: number;
  overdue: number;
  awaiting_approval: number;
  extensions_pending: number;
}

export interface ResourceViewItem {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  active_count: number;
  overdue_count: number;
}

export type TaskScope = 'mine' | 'dept' | 'branch';

export interface TasksDashboardResult {
  counts: DashboardCounts;
  lists: TaskListItem[];
  resource_view: ResourceViewItem[];
  scope: TaskScope;
  role: string;
}

// Detail (page [id]) lấy qua direct query — không qua RPC (cần join phong phú hơn)
export type TaskRow = Tables<'tasks'>;
export type TaskCommentRow = Tables<'task_comments'>;
export type TaskExtensionRow = Tables<'task_extension_requests'>;

export interface TaskDetail extends TaskRow {
  last_reminded_at?: string | null;
  department: { id: string; name: string } | null;
  creator: { id: string; full_name: string | null; avatar_url: string | null; department_id?: string | null } | null;
  assignees: Array<{ id: string; full_name: string | null; avatar_url: string | null }>;
  comments: Array<TaskCommentRow & {
    user: { id: string; full_name: string | null; avatar_url: string | null } | null;
  }>;
  extension_requests: Array<TaskExtensionRow & {
    requester: { id: string; full_name: string | null; avatar_url: string | null } | null;
  }>;
}

// Result chuẩn của taskActions wrappers
export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

// Hiển thị list: tất cả đều là batch entry (batchId=null với task lẻ)
export type TaskListEntry = {
  kind: 'batch';
  batchId: string | null;
  children: TaskListItem[];
  representative: TaskListItem;
};
