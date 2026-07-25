// Giao tiếp dữ liệu thảo luận/ý kiến của hồ sơ vật lý

import { createClient } from "@/utils/supabase/client";
import type { DocumentComment } from "./types";

const supabase = createClient();

const COMMENT_SELECT = `
  *,
  user:profiles!user_id (
    id,
    full_name,
    avatar_url,
    department_id,
    departments ( name )
  )
`;

export async function fetchDocumentComments(documentId: string): Promise<DocumentComment[]> {
  const { data, error } = await supabase
    .from("document_comments")
    .select(COMMENT_SELECT)
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchDocumentComments error (raw):", error);
    console.error("fetchDocumentComments error (fields):", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: (error as any).hint,
      statusCode: (error as any).statusCode,
    });
    return [];
  }

  return (data || []) as unknown as DocumentComment[];
}

export async function addDocumentComment(
  documentId: string,
  userId: string,
  content: string
): Promise<{ ok: true; comment: DocumentComment } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("document_comments")
    .insert({
      document_id: documentId,
      user_id: userId,
      content: content.trim(),
    })
    .select(COMMENT_SELECT)
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, comment: data as unknown as DocumentComment };
}
