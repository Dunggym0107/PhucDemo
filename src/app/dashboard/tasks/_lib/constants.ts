// Hằng số UI cho module Công việc — status/priority label, màu, icon class.
import type { TaskStatus, TaskPriority } from './types';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Chưa làm',
  doing: 'Đang làm',
  submitted: 'Đã nộp',
  done: 'Hoàn thành',
  canceled: 'Đã hủy',
};

// Class màu badge theo token globals.css
export const STATUS_BADGE_CLASS: Record<TaskStatus, string> = {
  todo: 'status-neutral-bg',
  doing: 'status-warning-bg',
  submitted: 'status-info-bg',
  done: 'status-success-bg',
  canceled: 'status-neutral-bg',
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Ưu tiên thấp',
  medium: 'Bình thường',
  high: 'Khẩn trương',
};

export const PRIORITY_BADGE_CLASS: Record<TaskPriority, string> = {
  low: 'status-neutral-bg',
  medium: 'status-info-bg',
  high: 'status-danger-bg',
};

export const SCOPE_LABEL: Record<'mine' | 'dept' | 'branch', string> = {
  mine: 'Của tôi',
  dept: 'Cả phòng',
  branch: 'Toàn chi nhánh',
};

// Group "Quá hạn" / "Hôm nay" / "Tuần này" / "Sau này" / "Đã hoàn thành"
export type DateGroup = 'overdue' | 'today' | 'this_week' | 'later' | 'no_deadline' | 'completed';

export const DATE_GROUP_LABEL: Record<DateGroup, string> = {
  overdue: 'Quá hạn',
  today: 'Hôm nay',
  this_week: 'Tuần này',
  later: 'Sau này',
  no_deadline: 'Không hạn',
  completed: 'Đã hoàn thành',
};
