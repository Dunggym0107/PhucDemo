// Wrapper cho mọi RPC của module Tasks. Tuân theo pattern handover/_lib/transferActions.ts:
// return { ok: true, data } | { ok: false, error } — caller chỉ cần `if (!res.ok) notifyError(res.error)`.

import { createClient } from '@/utils/supabase/client';
import type { TaskStatus, TaskPriority, ActionResult } from './types';

// Module-level supabase client là intentional — chỉ dùng trong client component
const supabase = createClient();

export async function createTask(input: {
  title: string;
  description?: string | null;
  priority?: TaskPriority | null;
  due_date: string;
  dept_id?: string | null;
  assignee_ids: string[] | null;
  metadata?: Record<string, unknown>;
  requires_approval?: boolean;
  batch_id?: string | null;
}): Promise<ActionResult<string>> {
  const { data, error } = await supabase.rpc('task_create', {
    p_title: input.title,
    p_description: input.description ?? null,
    p_priority: input.priority ?? 'medium',
    p_due_date: input.due_date,
    p_dept_id: input.dept_id ?? null,
    p_assignee_ids: input.assignee_ids,
    p_metadata: (input.metadata ?? {}) as any,
    p_requires_approval: input.requires_approval ?? false,
    p_batch_id: input.batch_id ?? null,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as string };
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  comment?: string,
): Promise<ActionResult> {
  const { error } = await supabase.rpc('task_update_status', {
    p_task_id: taskId,
    p_new_status: newStatus,
    p_comment: comment ?? null,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Duyệt kết quả (submitted → done). Nhận xét optional — nếu có sẽ vào timeline.
export async function approveTask(
  taskId: string,
  comment?: string,
): Promise<ActionResult> {
  return updateTaskStatus(taskId, 'done', comment);
}

// Trả về sửa lại (submitted → doing). Bắt buộc lý do.
export async function rejectSubmission(
  taskId: string,
  reason: string,
): Promise<ActionResult> {
  return updateTaskStatus(taskId, 'doing', reason);
}

// Mở lại công việc đã hoàn thành (done → doing). Bắt buộc lý do.
export async function reopenDone(
  taskId: string,
  reason: string,
): Promise<ActionResult> {
  return updateTaskStatus(taskId, 'doing', reason);
}

export async function delegateTask(taskId: string, assigneeIds: string[]): Promise<ActionResult> {
  const { error } = await supabase.rpc('task_delegate', {
    p_task_id: taskId,
    p_assignee_ids: assigneeIds,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function requestExtension(input: {
  task_id: string;
  new_due_date: string;
  reason?: string;
}): Promise<ActionResult<string>> {
  const { data, error } = await supabase.rpc('task_request_extension', {
    p_task_id: input.task_id,
    p_new_due_date: input.new_due_date,
    p_reason: input.reason ?? null,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as string };
}

export async function decideExtension(
  extensionId: string,
  approve: boolean,
  comment?: string,
): Promise<ActionResult> {
  const { error } = await supabase.rpc('task_decide_extension', {
    p_extension_id: extensionId,
    p_approve: approve,
    p_comment: comment ?? null,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addComment(
  taskId: string,
  body: string,
  attachmentIds?: string[],
): Promise<ActionResult<string>> {
  const { data, error } = await supabase.rpc('task_add_comment', {
    p_task_id: taskId,
    p_body: body,
    p_attachment_ids: attachmentIds ?? null,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as string };
}

export async function cancelTask(taskId: string, reason?: string): Promise<ActionResult> {
  const { error } = await supabase.rpc('task_cancel', {
    p_task_id: taskId,
    p_reason: reason ?? null,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Sửa nội dung task. Chỉ sửa được title/description/priority/due_date —
// department/assignee/requires_approval đã chốt từ lúc tạo.
export async function updateTask(
  taskId: string,
  input: {
    title: string;
    description?: string | null;
    priority: TaskPriority;
    due_date: string;
    department_id?: string | null;
    assignee_ids?: string[] | null;
    requires_approval?: boolean;
  },
): Promise<ActionResult> {
  const { error } = await supabase.rpc('task_update', {
    p_task_id: taskId,
    p_title: input.title,
    p_description: input.description ?? null,
    p_priority: input.priority,
    p_due_date: input.due_date,
    p_dept_id: input.department_id ?? null,
    p_assignee_ids: input.assignee_ids ?? null,
    p_requires_approval: input.requires_approval ?? false,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteTask(taskId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('task_delete', {
    p_task_id: taskId,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function archiveTask(taskId: string, archive = true): Promise<ActionResult> {
  const { error } = await supabase.rpc('task_archive', {
    p_task_id: taskId,
    p_archive: archive,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function remindTask(taskId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('task_remind', {
    p_task_id: taskId,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

