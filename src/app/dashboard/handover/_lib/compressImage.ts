// Nén ảnh phía client trước khi upload — giảm dung lượng & tăng tốc
import imageCompression from "browser-image-compression";
import { IMAGE_COMPRESSION_OPTS } from "./constants";

export async function compressDocumentImage(file: File): Promise<File> {
  // Bỏ qua ảnh < 200KB (đã đủ nhỏ)
  if (file.size < 200 * 1024) return file;
  try {
    const compressed = await imageCompression(file, IMAGE_COMPRESSION_OPTS);
    return compressed;
  } catch (err) {
    console.warn("compressDocumentImage failed, fallback to original:", err);
    return file;
  }
}
