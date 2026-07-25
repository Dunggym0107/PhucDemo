// Helpers cho module Nhân sự — pure functions, dễ test.
// Tách khỏi component để tái dùng giữa Card, Dialog, Widget.

import { ProfileStatus, NEW_JOINER_DAYS } from './constants';
import { canViewBusinessTripBadge } from '@/lib/permissions';

// Bỏ dấu tiếng Việt + lowercase. Reuse cho search no-accent.
export function normalizeSearch(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

// Tính trạng thái hiển thị badge cho 1 profile dựa trên schedules + OOO active.
// Ưu tiên: birthday > on_leave > on_trip > ooo > new_joiner > available.
export function getProfileBadgeStatus(
  profile: any,
  todaySchedules: any[],
  oooActive: any | null,
  viewer: any | null,
  now: Date = new Date(),
): ProfileStatus {
  if (!profile) return 'available';

  // On leave / on trip — chỉ approved + in_progress, start <= now <= end
  const mine = todaySchedules.filter(s =>
    (s.created_by === profile.id || (s.schedule_participants && s.schedule_participants.some((p: any) => p.profile_id === profile.id))) &&
    ['approved', 'in_progress'].includes(s.status) &&
    new Date(s.start_time) <= now &&
    new Date(s.end_time) >= now,
  );
  if (mine.some(s => s.type === 'leave')) return 'on_leave';
  if (mine.some(s => s.type === 'trip') && (!viewer || canViewBusinessTripBadge(viewer, profile))) return 'on_trip';

  // OOO — có message active
  if (oooActive && new Date(oooActive.ends_at) > now) return 'ooo';

  // New joiner — trong 30 ngày gần nhất
  if (profile.branch_join_date) {
    const join = new Date(profile.branch_join_date);
    const diffDays = (now.getTime() - join.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays >= 0 && diffDays <= NEW_JOINER_DAYS) return 'new_joiner';
  }

  return 'available';
}

// Match profile với từ khóa search trên nhiều field (no-accent).
export function matchProfileSearch(profile: any, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const haystack = [
    profile.full_name,
    profile.phone,
    profile.extension,
    profile.title,
    profile.ad_account,
    profile.employee_code,
    profile.departments?.name ?? (Array.isArray(profile.departments) ? profile.departments[0]?.name : ''),
  ].map(normalizeSearch).join(' ');
  return haystack.includes(q);
}

// Tính số năm gắn bó. Trả về số nguyên năm hoặc null.
export function getYearsOfService(branchJoinDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!branchJoinDate) return null;
  const join = new Date(branchJoinDate);
  if (isNaN(join.getTime())) return null;
  let years = now.getFullYear() - join.getFullYear();
  const m = now.getMonth() - join.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < join.getDate())) years--;
  return years >= 0 ? years : null;
}
