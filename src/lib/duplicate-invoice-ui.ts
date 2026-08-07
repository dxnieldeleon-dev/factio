// Puente entre duplicateInvoice() (lógica pura de datos) y la UI: dispara la
// duplicación, guarda temporalmente los avisos de cambio de precio para que
// la pantalla del nuevo borrador los muestre después de navegar, y
// centraliza el toast/manejo de errores para los dos puntos de entrada
// (detalle de factura e historial) — así ambos se comportan idénticamente.

import { toast } from "sonner";
import { duplicateInvoice, type PriceWarning } from "@/lib/duplicate-invoice";

export { duplicateInvoice };

function warningsKey(invoiceId: string) {
  return `factio.duplicateWarnings.${invoiceId}`;
}

export function readDuplicateWarnings(invoiceId: string): PriceWarning[] | null {
  try {
    const raw = sessionStorage.getItem(warningsKey(invoiceId));
    if (!raw) return null;
    sessionStorage.removeItem(warningsKey(invoiceId));
    return JSON.parse(raw) as PriceWarning[];
  } catch {
    return null;
  }
}

export async function runDuplicateFromInvoice(
  sourceInvoiceId: string,
): Promise<{ invoiceId: string } | null> {
  try {
    const result = await duplicateInvoice(sourceInvoiceId);
    if (result.priceWarnings.length > 0) {
      try {
        sessionStorage.setItem(warningsKey(result.invoiceId), JSON.stringify(result.priceWarnings));
      } catch {
        // sessionStorage no disponible (p. ej. modo privado): el aviso de
        // cambio de precio simplemente no se muestra, la duplicación sigue.
      }
    }
    if (result.clientMissing) {
      toast.warning(
        "El cliente de la factura original ya no existe. Actualízalo antes de timbrar este borrador.",
      );
    }
    toast.success("Factura duplicada como borrador");
    return { invoiceId: result.invoiceId };
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "No pudimos duplicar la factura");
    return null;
  }
}
