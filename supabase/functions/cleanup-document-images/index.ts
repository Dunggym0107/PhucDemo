// ============================================================================
// Edge Function: cleanup-document-images
// ----------------------------------------------------------------------------
// Quét các hồ sơ COMPLETED quá 30 ngày → xoá cứng file ảnh trong Storage và
// clear cột attached_image_urls. Theo pattern push-notification (Deno).
// Lịch chạy: Supabase Dashboard → Database → Cron → daily `0 19 * * *` UTC
// (= 02:00 ICT). Hoặc gọi POST trực tiếp khi cần.
// ============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const STORAGE_PATH_MARKER = "/storage/v1/object/public/documents/"

function extractStoragePath(publicUrl: string): string | null {
  const at = publicUrl.indexOf(STORAGE_PATH_MARKER)
  if (at < 0) return null
  return publicUrl.substring(at + STORAGE_PATH_MARKER.length)
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const supabase = createClient(supabaseUrl, serviceKey)

    // 1. Quét hồ sơ COMPLETED quá 30 ngày, vẫn còn ảnh
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: docs, error: queryErr } = await supabase
      .from("documents")
      .select("id, attached_image_urls, completed_at")
      .eq("status", "COMPLETED")
      .lt("completed_at", cutoff)
      .not("attached_image_urls", "eq", "{}")
      .limit(200)

    if (queryErr) throw queryErr

    if (!docs || docs.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "Không có hồ sơ nào cần dọn", cleaned: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    let totalFilesRemoved = 0
    const failedDocs: string[] = []

    for (const doc of docs) {
      const urls = (doc.attached_image_urls || []) as string[]
      if (urls.length === 0) continue

      const paths = urls
        .map(extractStoragePath)
        .filter((p): p is string => !!p)

      if (paths.length > 0) {
        const { error: rmErr } = await supabase.storage.from("documents").remove(paths)
        if (rmErr) {
          console.warn(`Storage remove failed for doc ${doc.id}:`, rmErr.message)
          failedDocs.push(doc.id)
          continue
        }
        totalFilesRemoved += paths.length
      }

      // Clear cột bất kể số file xoá được (paths không hợp lệ vẫn coi như đã sạch)
      const { error: updErr } = await supabase
        .from("documents")
        .update({ attached_image_urls: [] })
        .eq("id", doc.id)
      if (updErr) {
        console.warn(`Update doc ${doc.id} failed:`, updErr.message)
        failedDocs.push(doc.id)
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        docs_processed: docs.length,
        files_removed: totalFilesRemoved,
        failed_docs: failedDocs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )
  } catch (err) {
    console.error("cleanup-document-images error:", err.message)
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})
