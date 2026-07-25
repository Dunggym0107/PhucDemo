import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function compareProfilesByHierarchy(a: any, b: any) {
  const getRolePriority = (role?: string) => {
    if (role === "director") return 0
    if (role === "manager") return 1
    return 2
  }

  const roleA = getRolePriority(a?.role)
  const roleB = getRolePriority(b?.role)
  if (roleA !== roleB) return roleA - roleB

  const headA = a?.is_department_head === true ? 0 : 1
  const headB = b?.is_department_head === true ? 0 : 1
  if (headA !== headB) return headA - headB

  return (a?.full_name || "").localeCompare(b?.full_name || "", "vi")
}

export function sortProfilesByHierarchy<T extends { role?: string | null; is_department_head?: boolean | null; full_name?: string | null }>(profiles: T[]) {
  return [...profiles].sort(compareProfilesByHierarchy)
}

// Title hiển thị topnav/fallback: ưu tiên field title (admin đã nhập đủ chức danh).
// Chỉ fallback role label khi title rỗng — không tự ghép "Trưởng phòng" theo
// is_department_head vì sẽ trùng với title (tạo duplicate badge).
export function getProfileDisplayTitle(profile: any) {
  const title = typeof profile?.title === "string" ? profile.title.trim() : "";
  if (title) return title;

  if (profile?.role === "admin") return "Quản trị hệ thống";
  if (profile?.role === "director") return "Ban giám đốc";
  if (profile?.role === "manager") return "Lãnh đạo đơn vị";
  if (profile?.role === "hr_officer") return "Cán bộ Nhân sự";
  if (profile?.role === "driver") return "Lái xe cơ quan";
  if (profile?.role === "secretary") return "Lễ tân";
  return "Cán bộ";
}

export function getProfileTitleBadgeClass(profile: any) {
  if (profile?.role === "admin") return "bg-slate-900 text-white shadow-sm";
  if (profile?.role === "director") return "bg-primary text-white shadow-primary-glow";
  if (profile?.is_department_head === true) return "bg-amber-50 text-amber-700 border border-amber-200";
  if (profile?.role === "manager") return "bg-blue-50 text-blue-700 border border-blue-200";
  if (profile?.role === "hr_officer") return "bg-sky-50 text-sky-700 border border-sky-200";
  if (profile?.role === "driver") return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (profile?.role === "secretary") return "bg-amber-50 text-amber-800 border border-amber-200";
  return "bg-slate-50 text-slate-600 border border-slate-100";
}

export function canViewLeaveDetails(leave: any, currentUser: any) {
  if (!leave || !currentUser) return false;
  if (leave.type !== 'leave') return true;

  const creatorId = leave.created_by || leave.creator?.id;
  if (creatorId === currentUser.id) return true;

  if (currentUser.role === 'admin' || currentUser.role === 'hr_officer' || currentUser.role === 'director') return true;

  const creator = leave.creator;
  if (creator) {
    if (currentUser.role === 'manager') {
      const isCurrentUserHead = currentUser.is_department_head === true;
      const isCreatorHead = creator.is_department_head === true;
      const isCreatorManager = creator.role === 'manager';

      return (
        creator.department_id === currentUser.department_id &&
        (isCurrentUserHead || (!isCreatorHead && !isCreatorManager))
      );
    }
  }

  return false;
}
