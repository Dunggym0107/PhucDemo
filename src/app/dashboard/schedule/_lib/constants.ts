import {
  Calendar as CalendarIcon,
  Users,
  Car,
  Palmtree,
} from "lucide-react";

export const typeLabels: any = {
  meeting: { label: "Đi công tác", color: "status-warning-bg", icon: Car },
  trip: { label: "Đi công tác", color: "status-warning-bg", icon: Car },
  event: { label: "Sự kiện chi nhánh", color: "bg-slate-50 text-slate-700 border-slate-200", icon: CalendarIcon },
  leave: { label: "Nghỉ phép", color: "status-neutral-bg border-slate-200", icon: Palmtree },
};

export const statusLabels: any = {
  pending:     { label: "Đang chờ",    color: "bg-amber-50 text-amber-700 border border-amber-200" },
  approved:    { label: "Đã xác nhận", color: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  rejected:    { label: "Từ chối",     color: "bg-red-50 text-red-700 border border-red-200" },
  in_progress: { label: "Đang thực hiện", color: "bg-blue-50 text-blue-700 border border-blue-200" },
  completed:   { label: "Hoàn thành",  color: "bg-slate-100 text-slate-500 border border-slate-200" },
};

export const directorColors = [
  {
    bg: 'bg-blue-50/90',
    border: 'border-blue-200',
    text: 'text-blue-800',
    bullet: 'bg-blue-600',
    pill: 'bg-blue-50/90 text-blue-800 border-blue-200 hover:bg-blue-100',
    hover: 'hover:bg-blue-100'
  },
  {
    bg: 'bg-amber-50/90',
    border: 'border-amber-200',
    text: 'text-amber-800',
    bullet: 'bg-amber-600',
    pill: 'bg-amber-50/90 text-amber-800 border-amber-200 hover:bg-amber-100',
    hover: 'hover:bg-amber-100'
  },
  {
    bg: 'bg-emerald-50/90',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    bullet: 'bg-emerald-600',
    pill: 'bg-emerald-50/90 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
    hover: 'hover:bg-emerald-100'
  },
  {
    bg: 'bg-violet-50/90',
    border: 'border-violet-200',
    text: 'text-violet-800',
    bullet: 'bg-violet-600',
    pill: 'bg-violet-50/90 text-violet-800 border-violet-200 hover:bg-violet-100',
    hover: 'hover:bg-violet-100'
  },
  {
    bg: 'bg-sky-50/90',
    border: 'border-sky-200',
    text: 'text-sky-800',
    bullet: 'bg-sky-600',
    pill: 'bg-sky-50/90 text-sky-800 border-sky-200 hover:bg-sky-100',
    hover: 'hover:bg-sky-100'
  },
  {
    bg: 'bg-cyan-50/90',
    border: 'border-cyan-200',
    text: 'text-cyan-800',
    bullet: 'bg-cyan-600',
    pill: 'bg-cyan-50/90 text-cyan-800 border-cyan-200 hover:bg-cyan-100',
    hover: 'hover:bg-cyan-100'
  },
  {
    bg: 'bg-teal-50/90',
    border: 'border-teal-200',
    text: 'text-teal-800',
    bullet: 'bg-teal-600',
    pill: 'bg-teal-50/90 text-teal-800 border-teal-200 hover:bg-teal-100',
    hover: 'hover:bg-teal-100'
  },
  {
    bg: 'bg-stone-100/90',
    border: 'border-stone-300',
    text: 'text-stone-800 font-semibold',
    bullet: 'bg-stone-600',
    pill: 'bg-stone-100/90 text-stone-800 border-stone-300 hover:bg-stone-200',
    hover: 'hover:bg-stone-200'
  }
];

// === Khung giờ làm việc mặc định ===
export const HOUR_START = 5;   // 05:00
export const HOUR_END   = 20;  // 20:00
export const HOUR_RANGE = HOUR_END - HOUR_START; // 15h
export const MINUTE_STEP = 30; // bước nhảy mặc định

// Danh sách giờ từ HOUR_START đến HOUR_END
export const timeOptions = Array.from({ length: HOUR_RANGE * (60 / MINUTE_STEP) + 1 }).map((_, i) => {
  const totalMinutes = HOUR_START * 60 + i * MINUTE_STEP;
  const hour = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minute = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hour}:${minute}`;
});
