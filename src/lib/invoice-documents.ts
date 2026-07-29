import { supabase } from "@/integrations/supabase/client";

const CFDI_BUCKET = "cfdi-documents";

function isExternalUrl(value: string) {
  return /^(https?:|data:)/i.test(value);
}

/** Resolves legacy URLs and current private-storage paths without exposing PAC credentials. */
export async function resolveInvoiceDocumentUrl(pathOrUrl: string): Promise<string> {
  if (isExternalUrl(pathOrUrl)) return pathOrUrl;

  const { data, error } = await supabase.storage
    .from(CFDI_BUCKET)
    .createSignedUrl(pathOrUrl, 60 * 10);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "No fue posible obtener el archivo fiscal.");
  }
  return data.signedUrl;
}

export async function openInvoiceDocument(pathOrUrl: string) {
  const url = await resolveInvoiceDocumentUrl(pathOrUrl);
  window.open(url, "_blank", "noopener,noreferrer");
}
