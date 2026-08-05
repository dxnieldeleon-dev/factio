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
 * Shares the invoice PDF on WhatsApp. Prefers the OS-native share sheet
 * (Web Share API with an actual File) so WhatsApp receives the PDF as a
 * real attachment — a wa.me link can only ever carry text, never a file,
 * which is why the old implementation could only send a link to the PDF
 * instead of the PDF itself.
 *
 * Falls back to the wa.me link (opened via a synchronously pre-opened tab,
 * so the click's user gesture survives the async signed-URL fetch) when the
 * native share sheet isn't available at all, e.g. most desktop browsers.
 */
export async function shareInvoiceOnWhatsApp(
  pdfPathOrUrl: string,
  message: string,
  phone?: string | null,
  fileName = "factura.pdf",
) {
  const canTryNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  if (canTryNativeShare) {
    try {
      const url = await resolveInvoiceDocumentUrl(pdfPathOrUrl, 60 * 10);
      const response = await fetch(url);
      if (!response.ok) throw new Error("No fue posible descargar el PDF para compartir.");
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: message });
        return;
      }
    } catch (err) {
      // User closing the native share sheet is not an error — nothing to
      // fall back to, that was the user's choice.
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Any other failure (unsupported file type, fetch error, etc.) falls
      // through to the wa.me link below.
    }
  }

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
