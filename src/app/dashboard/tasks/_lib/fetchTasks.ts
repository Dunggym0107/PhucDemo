// Fetch detail 1 task — gọi trực tiếp (không qua RPC) vì cần join phong phú cho timeline + comments.
import { createClient } from '@/utils/supabase/client';
import { canSelectSpecificAssigneesAcrossDepartments } from '@/lib/permissions';
import type { TaskDetail } from './types';

const supabase = createClient();

const DETAIL_SELECT = `
  *,
  department:departments ( id, name ),
  creator: profiles!tasks_created_by_fkey ( id, full_name, avatar_url, department_id ),
  assignees:task_assignees (
    user:profiles ( id, full_name, avatar_url )
  ),
  comments:task_comments (
    id, task_id, user_id, content, created_at,
    user:profiles ( id, full_name, avatar_url )
  ),
  extension_requests:task_extension_requests (
    *, requester:profiles!task_extension_requests_requested_by_fkey ( id, full_name, avatar_url )
  )
`;

export async function fetchTaskDetail(taskId: string): Promise<TaskDetail | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select(DETAIL_SELECT)
    .eq('id', taskId)
    .single();
  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('fetchTaskDetail error:', error);
    }
    return null;
  }
  const raw = data as any;
  const detail: TaskDetail = {
    ...raw,
    assignees: (raw.assignees ?? []).map((a: any) => a.user).filter(Boolean),
    comments: (raw.comments ?? []).sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    ),
    extension_requests: raw.extension_requests ?? [],
  };
  return detail;
}

export async function fetchDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, code')
    .order('code', { ascending: true, nullsFirst: false });
  if (error) {
    console.error('fetchDepartments error:', error);
    return [];
  }
  return data ?? [];
}

interface CallerProfile {
  id: string;
  role: string | null;
  department_id: string | null;
  // Code phòng để check phòng đầu mối — bắt buộc để fetch đúng scope
  department_code?: string | null;
}

export type AssignContext = 'create-task' | 'create-assignment' | 'delegate';

interface AssignOpts {
  context: AssignContext;
  caller: CallerProfile;
  taskDepartmentId?: string | null;
}

const HUB_DEPT_CODES = new Set(['13618', '13601', '13602', '13605', '13609', '13603']);

function isHubCaller(caller: CallerProfile): boolean {
  return !!caller.department_code && HUB_DEPT_CODES.has(caller.department_code);
}

/**
 * Fetch profiles có thể nhận công việc, filter sẵn ở DB:
 *
 *   Staff non-hub: empty (UI ẩn tab).
 *   Manager / Staff trong phạm vi cá nhân: CHỈ phòng mình.
 *     Cross-dept phải đi qua DepartmentPicker (giao cho phòng → TP nhận).
 *   Admin/Director: toàn nhánh.
 *
 *   delegate: theo task.department_id.
 *
 * Tất cả: loại admin/director/driver/secretary/hr_officer khỏi candidate list.
 * Sort: TP → PP → Cán bộ → alphabet.
 */
export async function fetchAssignableProfiles(opts: AssignOpts) {
  const { context, caller, taskDepartmentId } = opts;
  const isHub = isHubCaller(caller);

  // Staff (any) tạo task: chỉ tự ghi chú
  if (context === 'create-task' && caller.role === 'staff') {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, title, department_id, is_department_head, is_active, departments(name, code)')
      .eq('id', caller.id)
      .single();
    return data ? [data] : [];
  }

  // Staff non-hub không được giao công việc cho người khác
  if (context === 'create-assignment' && caller.role === 'staff' && !isHub) {
    return [];
  }

  let q = supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, title, department_id, is_department_head, is_active, departments(name, code)')
    .eq('is_active', true)
    .not('role', 'in', '(admin,director,driver,secretary,hr_officer)');

  if (context === 'delegate') {
    if (!taskDepartmentId) return [];
    q = q.eq('department_id', taskDepartmentId);
  } else if (context === 'create-task' && caller.role === 'manager') {
    // Manager (kể cả hub) giao task đích danh: chỉ trong phòng mình.
    // Hub manager muốn giao cho phòng khác → đi qua DepartmentPicker (auto-fill TP).
    if (!caller.department_id) return [];
    q = q.eq('department_id', caller.department_id);
  } else if (context === 'create-assignment' && !canSelectSpecificAssigneesAcrossDepartments(caller)) {
    // Mọi role (manager/staff, kể cả hub) chọn cán bộ cụ thể: chỉ phòng mình.
    // Cross-dept đi qua DepartmentPicker → TP phòng nhận tự phân công.
    if (!caller.department_id) return [];
    q = q.eq('department_id', caller.department_id);
  }
  // Còn lại: admin/director → toàn nhánh

  q = q
    .order('is_department_head', { ascending: false, nullsFirst: false })
    .order('role', { ascending: true })
    .order('full_name', { ascending: true });

  const { data, error } = await q;
  if (error) {
    console.error('fetchAssignableProfiles error:', error);
    return [];
  }
  return data ?? [];
}

// Lấy danh sách task cùng batch (kể cả task hiện tại). Caller tự filter theo
// status/is_archived tuỳ nghiệp vụ.
export interface BatchSibling {
  id: string;
  status: string;
  is_archived: boolean;
  created_at: string;
  created_by?: string | null;
  creator?: { id: string; department_id: string | null } | null;
  department: { name: string | null } | null;
}

export async function fetchBatchSiblings(batchId: string): Promise<BatchSibling[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, status, is_archived, created_at, created_by, department:departments(name), creator:profiles!tasks_created_by_fkey(id, department_id)')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('fetchBatchSiblings error:', error);
    return [];
  }
  return (data ?? []) as unknown as BatchSibling[];
}
