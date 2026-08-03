import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-images";
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export function isValidProductImage(file: File): string | null {
  if (!file.type.startsWith("image/")) return "La foto debe ser una imagen (PNG, JPG, WEBP).";
  if (file.size > MAX_SIZE_BYTES) return "La foto no debe superar 5 MB.";
  return null;
}

/** Sube la foto de un producto/servicio y devuelve su URL pública. */
export async function uploadProductImage(
  userId: string,
  productId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${productId}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return productImageUrl(path);
}

export function productImageUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
