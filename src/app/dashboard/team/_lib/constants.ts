// Constants chia sẻ cho module Nhân sự (Team).
// Tách khỏi component để tái dùng giữa Card, Dialog, Widget.

export const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: "Quản trị hệ thống", color: "bg-slate-900 text-white shadow-sm" },
  director: { label: "Ban giám đốc", color: "bg-primary text-white shadow-primary-glow" },
  manager: { label: "Lãnh đạo đơn vị", color: "bg-amber-50 text-amber-600 border border-amber-200" },
  staff: { label: "Cán bộ", color: "bg-slate-50 text-slate-500 border border-slate-100" },
  secretary: { label: "Lễ tân", color: "bg-slate-50 text-slate-500 border border-slate-100" },
  hr_officer: { label: "Cán bộ Nhân sự", color: "bg-slate-50 text-slate-500 border border-slate-100" },
  driver: { label: "Lái xe cơ quan", color: "bg-slate-50 text-slate-500 border border-slate-100" },
};

export type ProfileStatus =
  | 'available'
  | 'on_leave'
  | 'on_trip'
  | 'ooo'
  | 'new_joiner';

export const STATUS_BADGES: Record<ProfileStatus, { label: string; dotColor: string; chipClass: string }> = {
  available: { label: 'Sẵn sàng', dotColor: 'bg-emerald-500', chipClass: 'status-success-bg' },
  on_leave: { label: 'Đang nghỉ phép', dotColor: 'bg-amber-500', chipClass: 'status-warning-bg' },
  on_trip: { label: 'Đi công tác', dotColor: 'bg-blue-500', chipClass: 'status-info-bg' },
  ooo: { label: 'Vắng mặt', dotColor: 'bg-amber-500', chipClass: 'status-warning-bg' },
  new_joiner: { label: 'Mới vào (30 ngày)', dotColor: 'bg-violet-500', chipClass: 'status-info-bg' },
};

export const RECOGNITION_TYPES = {
  great_work: { emoji: '👏', label: 'Làm việc xuất sắc' },
  team_player: { emoji: '🤝', label: 'Đồng đội tốt' },
  innovation: { emoji: '💡', label: 'Sáng kiến' },
  mentor: { emoji: '🎓', label: 'Hướng dẫn tận tâm' },
} as const;

export type RecognitionType = keyof typeof RECOGNITION_TYPES;

export const NEW_JOINER_DAYS = 30;
