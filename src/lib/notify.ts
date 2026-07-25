// Helper hiển thị toast — centralize 3 mẫu chuẩn theo ARCHITECTURE §7.2.
// Dùng thay cho việc gọi `toast({...})` inline 95 chỗ trong dự án.
//
// Cách dùng:
//   import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
//   notifyError(error, "Không lưu được hồ sơ");
//   notifySuccess("Đã chuyển hồ sơ", "Đợi người nhận xác nhận");
//   notifyValidation("Vui lòng nhập tiêu đề");

import { toast } from "@/hooks/use-toast";

// Trích message từ nhiều dạng error (Supabase PostgrestError, Error, string, RPC return)
function extractMessage(err: unknown): string | undefined {
  if (!err) return undefined;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const e = err as { message?: string; error?: string; details?: string };
    return e.message || e.error || e.details;
  }
  return undefined;
}

/**
 * Hiển thị toast lỗi. Title rút gọn, description ưu tiên `error.message`,
 * fallback về message tự nhập nếu không trích được.
 */
export function notifyError(error: unknown, fallback: string = "Có lỗi xảy ra, vui lòng thử lại") {
  const description = extractMessage(error) || fallback;
  toast({
    variant: "destructive",
    title: "Lỗi",
    description,
  });
}

/**
 * Hiển thị toast thành công. Title ngắn (động từ quá khứ),
 * description mô tả ngắn (tuỳ chọn).
 */
export function notifySuccess(title: string, description?: string) {
  toast({
    title,
    description,
  });
}

/**
 * Hiển thị toast validation form — chuẩn theo §7.2 với title "Thiếu thông tin".
 * Dùng cho các kiểm tra inline trước khi submit.
 */
export function notifyValidation(description: string, title: string = "Thiếu thông tin") {
  toast({
    variant: "destructive",
    title,
    description,
  });
}
