import { supabase } from "@/integrations/supabase/client";

const CFDI_BUCKET = "cfdi-documents";

function isExternalUrl(value: string) {
  return /^(https?:|data:)/i.test(value);
}

/** Resolves legacy URLs and current private-storage paths without exposing PAC credentials. */
export async function resolveInvoiceDocumentUrl(
  pathOrUrl: string,
  expiresInSeconds = 60 * 10,
): Promise<string> {
  if (isExternalUrl(pathOrUrl)) return pathOrUrl;

  const { data, error } = await supabase.storage
    .from(CFDI_BUCKET)
    .createSignedUrl(pathOrUrl, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "No fue posible obtener el archivo fiscal.");
  }
  return data.signedUrl;
}

export async function openInvoiceDocument(pathOrUrl: string) {
  const url = await resolveInvoiceDocumentUrl(pathOrUrl);
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Opens WhatsApp with a message linking to the invoice PDF. The link needs
 * to survive until the recipient actually opens it (not just the sender),
 * so it uses a much longer signed-URL expiry than openInvoiceDocument.
 *
 * Opens a blank tab synchronously (before the await) and redirects it once
 * the signed URL resolves — otherwise the async gap loses the click's user
 * gesture and browsers block the popup.
 */
export async function shareInvoiceOnWhatsApp(
  pdfPathOrUrl: string,
  message: string,
  phone?: string | null,
) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  try {
    const url = await resolveInvoiceDocumentUrl(pdfPathOrUrl, 60 * 60 * 24);
    const digits = (phone ?? "").replace(/\D/g, "");
    // Bare 10-digit numbers are assumed MX and get the country code; anything
    // else (already has a country code, or empty) is passed through as-is.
    const target = digits ? (digits.length === 10 ? `52${digits}` : digits) : "";
    const text = encodeURIComponent(`${message}\n${url}`);
    const waUrl = `https://wa.me/${target}?text=${text}`;
    if (popup) {
      popup.location.href = waUrl;
    } else {
      window.open(waUrl, "_blank", "noopener,noreferrer");
    }
  } catch (err) {
    popup?.close();
    throw err;
  }
}
