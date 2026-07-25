// Type định nghĩa cho module hồ sơ — khớp với schema Supabase

import type { DocumentStatus, HandoverStatus } from "./constants";

export interface DocumentCategory {
  id: string;
  name: string;
  sla_hours: number;
  color: "slate" | "blue" | "amber" | "emerald" | "red";
  created_by: string | null;
  created_at: string;
}

export interface DocumentProfileLite {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
  departments?: { name: string | null } | null;
}

export interface HandoverRow {
  id: string;
  document_id: string;
  sender_id: string;
  receiver_id: string;
  status: HandoverStatus;
  sent_at: string;
  received_at: string | null;
  note: string | null;
  reject_reason: string | null;
  created_at: string;
  sender?: DocumentProfileLite | null;
  receiver?: DocumentProfileLite | null;
}

export interface DocumentRow {
  id: string;
  short_code: string;
  title: string;
  customer_name: string | null;
  category_id: string | null;
  attached_image_urls: string[];
  creator_id: string;
  current_assignee_id: string | null;
  status: DocumentStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  category?: DocumentCategory | null;
  creator?: DocumentProfileLite | null;
  current_assignee?: DocumentProfileLite | null;
  handovers?: HandoverRow[];
}

export interface DocumentComment {
  id: string;
  document_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: DocumentProfileLite | null;
}
