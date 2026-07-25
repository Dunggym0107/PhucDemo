// Wrapper gọi RPC handover — bọc try/catch và return error message tiếng Việt

import { createClient } from "@/utils/supabase/client";

const supabase = createClient();

export async function transferDocument(
  documentId: string,
  receiverId: string,
  note: string | null
): Promise<{ ok: true; handoverId: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("transfer_document", {
    p_document_id: documentId,
    p_receiver_id: receiverId,
    p_note: note,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, handoverId: data as string };
}

export async function acknowledgeDocument(handoverId: string) {
  const { error } = await supabase.rpc("acknowledge_document", {
    p_handover_id: handoverId,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function rejectDocument(handoverId: string, reason: string) {
  const { error } = await supabase.rpc("reject_document", {
    p_handover_id: handoverId,
    p_reason: reason,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function completeDocument(documentId: string) {
 const { error } = await supabase.rpc("complete_document", {
   p_document_id: documentId,
 });
 if (error) return { ok: false as const, error: error.message };
 return { ok: true as const };
}

export async function adminCompleteDocument(documentId: string) {
  const { error } = await supabase.rpc("admin_complete_document", {
    p_document_id: documentId,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
