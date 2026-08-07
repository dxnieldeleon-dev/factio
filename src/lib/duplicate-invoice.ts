// Duplicar factura: crea un nuevo borrador a partir de una factura existente
// (emitida, cancelada o incluso otro borrador), copiando cliente y conceptos
// pero recalculando retenciones, totales y el vínculo con el producto vigente
// — nunca copia ciegamente valores que puedan haber cambiado desde entonces.
//
// Reutiliza exactamente la misma lógica de retención/totales que el alta
// normal de factura (ver onIssue() en invoices.new.tsx): mismo resolver
// resolveTaxTreatment, misma regla de persona física sin retención, mismo
// redondeo toMoney.

import { supabase } from "@/integrations/supabase/client";
import { resolveTaxTreatment } from "@/lib/tax-withholding";
import type { Json } from "@/integrations/supabase/types";

// Mismo redondeo que usa el resto del flujo de facturación (wizard y Edge
// Function facturama-create-cfdi) para que los totales coincidan bit a bit.
function toMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface PriceWarning {
  product_id: string;
  description: string;
  old_price: number;
  current_price: number;
}

export interface DuplicateInvoiceResult {
  invoiceId: string;
  priceWarnings: PriceWarning[];
  clientMissing: boolean;
}

interface ClientSnapshot {
  legal_name?: string;
  rfc?: string;
  cfdi_use?: string;
  tax_regime?: string;
  postal_code?: string;
  business_category?: string;
}

export async function duplicateInvoice(sourceInvoiceId: string): Promise<DuplicateInvoiceResult> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Tu sesión no es válida. Inicia sesión nuevamente.");
  }
  const userId = userData.user.id;

  // Filtro explícito de user_id además de RLS: un usuario nunca debe poder
  // duplicar una factura ajena aunque adivine el invoiceId.
  const [{ data: sourceInvoice, error: invoiceError }, { data: sourceItems, error: itemsError }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, client_id, client_snapshot, payment_method, payment_form, cfdi_use, currency, exchange_rate, notes",
        )
        .eq("id", sourceInvoiceId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("invoice_items")
        .select(
          "product_id, sat_key, sat_unit, description, quantity, unit_price, discount, iva_rate, tax_object, unit_name",
        )
        .eq("invoice_id", sourceInvoiceId)
        .order("position"),
    ]);
  if (invoiceError) throw invoiceError;
  if (!sourceInvoice) throw new Error("Factura no encontrada.");
  if (itemsError) throw itemsError;
  if (!sourceItems || sourceItems.length === 0) {
    throw new Error("Esta factura no tiene conceptos que duplicar.");
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, tax_regime, activity_profiles(activity_category)")
    .eq("user_id", userId)
    .maybeSingle();
  if (companyError) throw companyError;
  if (!company) throw new Error("Configura tu perfil del negocio antes de duplicar facturas.");

  let client: {
    id: string;
    legal_name: string;
    rfc: string;
    tax_regime: string | null;
    postal_code: string | null;
    cfdi_use: string | null;
    is_technology_platform: boolean;
    business_category: string | null;
  } | null = null;
  if (sourceInvoice.client_id) {
    const { data } = await supabase
      .from("clients")
      .select(
        "id, legal_name, rfc, tax_regime, postal_code, cfdi_use, is_technology_platform, business_category",
      )
      .eq("id", sourceInvoice.client_id)
      .eq("user_id", userId)
      .maybeSingle();
    client = data ?? null;
  }
  // El cliente pudo haber sido eliminado desde que se emitió la factura
  // origen — el borrador igual se crea (con client_id null) en vez de
  // fallar; el snapshot histórico se conserva solo como referencia visual.
  const clientMissing = !client;
  const originalSnapshot = (sourceInvoice.client_snapshot as ClientSnapshot | null) ?? null;
  const receiverRfc = client?.rfc ?? originalSnapshot?.rfc ?? null;

  const taxTreatment = receiverRfc
    ? await resolveTaxTreatment({
        taxRegime: company.tax_regime,
        activityCategory: company.activity_profiles?.activity_category ?? null,
        rfc: receiverRfc,
        isTechnologyPlatform: client?.is_technology_platform ?? false,
      })
    : null;
  const isrPct = taxTreatment?.isrRetencionPct ?? 0;
  const ivaRetPct = taxTreatment?.ivaRetencionPct ?? 0;
  const isPersonaFisica = taxTreatment?.clientType === "persona_fisica";

  // Vuelve a consultar los productos vigentes (no los datos guardados en el
  // renglón original) para el override de retención y para detectar cambios
  // de precio — un producto eliminado se degrada a product_id null sin fallar,
  // conservando la descripción/clave SAT ya copiada en el renglón.
  const productIds = [
    ...new Set(sourceItems.map((i) => i.product_id).filter((id): id is string => !!id)),
  ];
  const productsById = new Map<
    string,
    {
      id: string;
      unit_price: number;
      isr_retencion_rate: number | null;
      iva_retencion_rate: number | null;
    }
  >();
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, unit_price, isr_retencion_rate, iva_retencion_rate")
      .in("id", productIds)
      .eq("user_id", userId);
    for (const p of products ?? []) {
      productsById.set(p.id, {
        id: p.id,
        unit_price: Number(p.unit_price),
        isr_retencion_rate: p.isr_retencion_rate === null ? null : Number(p.isr_retencion_rate),
        iva_retencion_rate: p.iva_retencion_rate === null ? null : Number(p.iva_retencion_rate),
      });
    }
  }

  const priceWarnings: PriceWarning[] = [];
  let subtotal = 0;
  let ivaTotal = 0;
  let isrRetencionTotal = 0;
  let ivaRetencionTotal = 0;

  const newItemRows = sourceItems.map((item, idx) => {
    const product = item.product_id ? productsById.get(item.product_id) : undefined;
    if (product && product.unit_price !== Number(item.unit_price)) {
      priceWarnings.push({
        product_id: product.id,
        description: item.description,
        old_price: Number(item.unit_price),
        current_price: product.unit_price,
      });
    }

    const lineSubtotal = toMoney(item.quantity * item.unit_price - item.discount);
    const isrFraction = isPersonaFisica ? 0 : (product?.isr_retencion_rate ?? isrPct / 100);
    const ivaRetFraction =
      isPersonaFisica || item.tax_object === "01"
        ? 0
        : (product?.iva_retencion_rate ?? ivaRetPct / 100);
    subtotal = toMoney(subtotal + lineSubtotal);
    ivaTotal = toMoney(ivaTotal + toMoney(lineSubtotal * item.iva_rate));
    isrRetencionTotal = toMoney(isrRetencionTotal + toMoney(lineSubtotal * isrFraction));
    ivaRetencionTotal = toMoney(ivaRetencionTotal + toMoney(lineSubtotal * ivaRetFraction));

    return {
      user_id: userId,
      product_id: product?.id ?? null,
      sat_key: item.sat_key,
      sat_unit: item.sat_unit,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount,
      iva_rate: item.iva_rate,
      tax_object: item.tax_object,
      unit_name: item.unit_name,
      iva_amount: (item.quantity * item.unit_price - item.discount) * item.iva_rate,
      isr_retencion_rate: isrFraction,
      isr_retencion_amount: toMoney(lineSubtotal * isrFraction),
      iva_retencion_rate: ivaRetFraction,
      iva_retencion_amount: toMoney(lineSubtotal * ivaRetFraction),
      amount: item.quantity * item.unit_price - item.discount,
      position: idx,
    };
  });
  const retentionsTotal = toMoney(isrRetencionTotal + ivaRetencionTotal);
  const total = toMoney(subtotal + ivaTotal - retentionsTotal);

  const newClientSnapshot = client
    ? {
        legal_name: client.legal_name,
        rfc: client.rfc,
        cfdi_use: client.cfdi_use,
        tax_regime: client.tax_regime,
        postal_code: client.postal_code,
        business_category: client.business_category,
      }
    : originalSnapshot;

  // folio: 0 y status: 'draft' — igual que un alta normal, el folio real
  // solo se asigna al confirmarse el timbrado (ver finalize_cfdi_stamp).
  // uuid_fiscal, pac_response, cancellation_*, stamped_at, pdf_url, xml_url,
  // etc. se omiten del insert y quedan en su default/NULL — nunca se copian
  // del origen.
  const { data: newInvoice, error: newInvoiceError } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      company_id: company.id,
      client_id: client?.id ?? null,
      client_snapshot: newClientSnapshot as unknown as Json,
      series: "A",
      folio: 0,
      status: "draft",
      payment_method: sourceInvoice.payment_method,
      payment_form: sourceInvoice.payment_form,
      cfdi_use: client?.cfdi_use ?? sourceInvoice.cfdi_use,
      currency: sourceInvoice.currency,
      // No hay una fuente de tipo de cambio en vivo en este proyecto (el
      // campo siempre se captura a mano en el wizard) — se parte del valor
      // original como punto de partida, pero el usuario debe confirmarlo en
      // la pantalla de edición antes de timbrar si la moneda no es MXN.
      exchange_rate: sourceInvoice.currency === "MXN" ? 1 : sourceInvoice.exchange_rate,
      subtotal,
      iva_total: ivaTotal,
      isr_retencion_total: isrRetencionTotal,
      iva_retencion_total: ivaRetencionTotal,
      retentions_total: retentionsTotal,
      total,
      // Codifica cfdi_type/export (ver invoiceMetadata en
      // facturama-create-cfdi) — debe copiarse tal cual para que el
      // duplicado se timbre con el mismo tipo de comprobante que el origen.
      notes: sourceInvoice.notes,
      duplicated_from_invoice_id: sourceInvoiceId,
    })
    .select("id")
    .single();
  if (newInvoiceError) throw newInvoiceError;

  const itemRows = newItemRows.map((row) => ({ ...row, invoice_id: newInvoice.id }));
  const { error: insertItemsError } = await supabase.from("invoice_items").insert(itemRows);
  if (insertItemsError) {
    await supabase.from("invoices").delete().eq("id", newInvoice.id).eq("status", "draft");
    throw insertItemsError;
  }

  return { invoiceId: newInvoice.id, priceWarnings, clientMissing };
}
