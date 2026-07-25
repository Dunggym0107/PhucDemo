import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export const createClient = () => {
  // Lấy giá trị trực tiếp trong function để đảm bảo Next.js Turbopack evaluate đúng lúc.
  // Thêm .trim() để loại bỏ ký tự \r (Carriage Return) nếu .env.local bị lỗi format trên Windows.
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();

  if (!supabaseUrl || !supabaseKey) {
    console.error("Lỗi: Thiếu biến môi trường NEXT_PUBLIC_SUPABASE_URL hoặc PUBLISHABLE_KEY");
  }

  if (!browserClient) {
    browserClient = createBrowserClient(
      supabaseUrl,
      supabaseKey,
    );
  }

  return browserClient;
};
