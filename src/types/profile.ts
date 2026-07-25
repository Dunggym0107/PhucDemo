// Type chung cho người dùng & phòng ban, dùng xuyên suốt dự án.
// Khi viết hook/component mới, ưu tiên dùng Profile thay vì `any`.
// Code cũ dùng `any` sẽ được migrate dần khi đụng vào.

export type UserRole =
  | "admin"
  | "director"
  | "manager"
  | "staff"
  | "secretary"
  | "hr_officer"
  | "driver";

export interface Department {
  id: string;
  name: string;
  code?: string | null;
  created_at?: string;
}

// Phiên bản rút gọn — dùng cho join lite (chỉ cần avatar + tên hiển thị).
// Khớp với SELECT pattern phổ biến `profiles ( id, full_name, avatar_url, ... )`.
export interface ProfileLite {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role?: UserRole | null;
  title?: string | null;
  department_id?: string | null;
  departments?: Pick<Department, "name" | "code"> | null;
  is_department_head?: boolean | null;
}

// Phiên bản đầy đủ — dùng cho profile của user đang đăng nhập (currentUser).
export interface Profile extends ProfileLite {
  phone?: string | null;
  birthday?: string | null;       // YYYY-MM-DD
  gender?: string | null;
  ad_account?: string | null;
  branch_join_date?: string | null;
  is_active?: boolean | null;
  must_change_password?: boolean | null;
  updated_at?: string;
}
