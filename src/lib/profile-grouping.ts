// Gom profile theo nhóm phòng ban — dùng chung cho mọi UI chọn người.
// Sort hierarchy đã có ở src/lib/utils.ts (compareProfilesByHierarchy).
//
// Quy tắc nhóm:
//   1) Ban Giám đốc (role='director') — GĐ trước PGĐ.
//   2) Phòng của tôi (department_id = caller.department_id).
//   3) Các phòng còn lại — sort theo departments.code asc.

import { compareProfilesByHierarchy } from '@/lib/utils';

export interface ProfileLike {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  department_id?: string | null;
  departments?: { name?: string | null; code?: string | null } | null;
  title?: string | null;
  is_department_head?: boolean | null;
}

export interface ProfileGroup<T extends ProfileLike = ProfileLike> {
  key: string;
  label: string;
  members: T[];
}

export interface GroupOptions {
  myDepartmentId?: string | null;
  myDepartmentName?: string | null;
  query?: string;
}

export function groupProfilesByDepartment<T extends ProfileLike>(
  profiles: T[],
  opts: GroupOptions = {},
): ProfileGroup<T>[] {
  const q = (opts.query ?? '').trim().toLowerCase();
  const matchSearch = (p: T) => !q || (p.full_name ?? '').toLowerCase().includes(q);

  const bgd: T[] = [];
  const myDept: T[] = [];
  const otherByDept = new Map<string, { name: string; code: string; members: T[] }>();

  for (const p of profiles) {
    if (!matchSearch(p)) continue;
    if (p.role === 'director') { bgd.push(p); continue; }

    const depts = p.departments;
    const first = Array.isArray(depts) ? depts[0] : depts;

    if (opts.myDepartmentId && p.department_id === opts.myDepartmentId) {
      myDept.push(p);
      continue;
    }

    const key = p.department_id ?? 'no-dept';
    const name = first?.name ?? 'Không có phòng ban';
    const code = first?.code ?? 'zzz';
    if (!otherByDept.has(key)) otherByDept.set(key, { name, code, members: [] });
    otherByDept.get(key)!.members.push(p);
  }

  const result: ProfileGroup<T>[] = [];

  if (bgd.length) {
    result.push({
      key: 'bgd',
      label: 'Ban Giám đốc',
      members: [...bgd].sort(compareProfilesByHierarchy),
    });
  }

  if (myDept.length) {
    result.push({
      key: 'mine',
      label: opts.myDepartmentName ? `Phòng của tôi (${opts.myDepartmentName})` : 'Phòng của tôi',
      members: [...myDept].sort(compareProfilesByHierarchy),
    });
  }

  const others = Array.from(otherByDept.entries())
    .sort(([, a], [, b]) => a.code.localeCompare(b.code, 'vi', { numeric: true }))
    .map(([id, val]) => ({
      key: `dept-${id}`,
      label: val.name,
      members: [...val.members].sort(compareProfilesByHierarchy),
    }));
  result.push(...others);

  return result;
}
