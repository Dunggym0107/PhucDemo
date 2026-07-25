// Query Supabase trả về list hồ sơ + categories + handovers
//
// Tối ưu performance (Gói D):
//   - Pagination cursor: chỉ fetch PAGE_SIZE bản ghi mỗi lần, "Xem thêm" lấy tiếp.
//   - Realtime chỉ refetch page 1 (luôn hiển thị docs mới nhất), load more tích luỹ.

import { createClient } from "@/utils/supabase/client";
import type { DocumentCategory, DocumentRow } from "./types";

const supabase = createClient();

export const PAGE_SIZE = 50;

// FK disambiguator dùng TÊN CỘT (an toàn hơn tên constraint Postgres tự sinh,
// vì constraint có thể có suffix _1, _2 nếu bảng từng drop-recreate).
//
// Slim payload (Gói C):
//   - creator/current_assignee VAN giữ nested departments(name) vì DocumentDetailDialog dùng.
//   - sender/receiver trong handovers chỉ cần full_name+avatar (HandoverTimeline) →
//     bỏ department_id + departments(name) → giảm ~30% payload hồ sơ có nhiều handover.
const LIST_SELECT = `
  *,
  category:document_categories ( id, name, sla_hours, color ),
  creator:profiles!creator_id ( id, full_name, avatar_url, department_id, departments ( name ) ),
  current_assignee:profiles!current_assignee_id ( id, full_name, avatar_url, department_id, departments ( name ) ),
  handovers:document_handovers (
    id, document_id, sender_id, receiver_id, status, sent_at, received_at, note, reject_reason, created_at,
    sender:profiles!sender_id ( id, full_name, avatar_url ),
    receiver:profiles!receiver_id ( id, full_name, avatar_url )
  )
`;

// Detail cần đầy đủ thong tin hơn (department) cho hầu hết profile liên quan.
const DETAIL_SELECT = `
  *,
  category:document_categories ( id, name, sla_hours, color ),
  creator:profiles!creator_id ( id, full_name, avatar_url, department_id, departments ( name ) ),
  current_assignee:profiles!current_assignee_id ( id, full_name, avatar_url, department_id, departments ( name ) ),
  handovers:document_handovers (
    id, document_id, sender_id, receiver_id, status, sent_at, received_at, note, reject_reason, created_at,
    sender:profiles!sender_id ( id, full_name, avatar_url, department_id, departments ( name ) ),
    receiver:profiles!receiver_id ( id, full_name, avatar_url, department_id, departments ( name ) )
  )
`;

// Helper: PostgrestError có property non-enumerable → console.log ra {}.
// Trích xuất các field quan trọng để debug dễ hơn.
function logSupabaseError(label: string, error: any) {
  console.error(label, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
}

export interface FetchResult {
  data: DocumentRow[];
  hasMore: boolean;
}

/**
 * Fetch documents với cursor pagination.
 * @param options.limit  Số bản ghi tối đa (mặc định PAGE_SIZE)
 * @param options.before Cursor: chỉ lấy documents có updated_at < giá trị này
 */
export async function fetchAllDocuments(options?: {
  limit?: number;
  before?: string;
}): Promise<FetchResult> {
  const fetchLimit = (options?.limit ?? PAGE_SIZE) + 1; // fetch dư 1 để phát hiện hasMore
  let query = supabase
    .from("documents")
    .select(LIST_SELECT)
    .order("updated_at", { ascending: false })
    .limit(fetchLimit);
  if (options?.before) {
    query = query.lt("updated_at", options.before);
  }
  const { data, error } = await query;
  if (error) {
    logSupabaseError("fetchAllDocuments error:", error);
    return { data: [], hasMore: false };
  }
  const docs = (data || []) as unknown as DocumentRow[];
  const hasMore = docs.length >= fetchLimit;
  if (hasMore) docs.pop(); // bỏ bản ghi dư đã dùng để detect
  return { data: docs, hasMore };
}

export async function fetchDocumentById(documentId: string): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from("documents")
    .select(DETAIL_SELECT)
    .eq("id", documentId)
    .single();
  if (error) {
    logSupabaseError("fetchDocumentById error:", error);
    return null;
  }
  return data as unknown as DocumentRow;
}

export async function fetchCategories(): Promise<DocumentCategory[]> {
  const { data, error } = await supabase
    .from("document_categories")
    .select("*")
    .order("name");
  if (error) {
    logSupabaseError("fetchCategories error:", error);
    return [];
  }
  return (data || []) as DocumentCategory[];
}
