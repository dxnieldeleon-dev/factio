// Client-side mirror of supabase/functions/_shared/tax/withholding.ts — used
// only to preview totals in the invoice wizard so what the user sees matches
// what the server will validate. The Edge Function (facturama-create-cfdi)
// recomputes this from scratch and is the actual source of truth; nothing
// here is trusted for the CFDI itself.

import { supabase } from "@/integrations/supabase/client";

export type ClientType = "persona_fisica" | "persona_moral" | "plataforma_tecnologica";

export interface TaxTreatment {
  clientType: ClientType;
  isrRetencionPct: number; // e.g. 1.25 meaning 1.25%, not a 0-1 fraction
  ivaRetencionPct: number; // e.g. 10.6667 meaning 10.6667%
  warning: string | null;
}

export function determineClientType(rfc: string, isTechnologyPlatform: boolean): ClientType {
  if (isTechnologyPlatform) return "plataforma_tecnologica";
  return rfc.trim().toUpperCase().length === 12 ? "persona_moral" : "persona_fisica";
}

export async function resolveTaxTreatment(params: {
  taxRegime: string | null;
  activityCategory: string | null;
  rfc: string;
  isTechnologyPlatform: boolean;
}): Promise<TaxTreatment> {
  const clientType = determineClientType(params.rfc, params.isTechnologyPlatform);

  if (clientType === "persona_fisica") {
    return { clientType, isrRetencionPct: 0, ivaRetencionPct: 0, warning: null };
  }

  if (clientType === "plataforma_tecnologica") {
    const { data, error } = await supabase
      .from("platform_isr_brackets")
      .select("id")
      .eq("is_active", true)
      .limit(1);
    if (error || !data || data.length === 0) {
      return {
        clientType,
        isrRetencionPct: 0,
        ivaRetencionPct: 0,
        warning:
          "Aún no hay tarifas de retención configuradas para plataformas tecnológicas; esta factura no llevará retención.",
      };
    }
    return {
      clientType,
      isrRetencionPct: 0,
      ivaRetencionPct: 0,
      warning:
        "La selección automática de tarifa por plataforma tecnológica aún no está disponible.",
    };
  }

  if (!params.taxRegime || !params.activityCategory) {
    return { clientType, isrRetencionPct: 0, ivaRetencionPct: 0, warning: null };
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("tax_withholding_rules")
    .select("isr_retencion_pct, iva_retencion_pct")
    .eq("tax_regime", params.taxRegime)
    .eq("client_type", clientType)
    .eq("activity_category", params.activityCategory)
    .eq("is_active", true)
    .lte("vigente_desde", today)
    .or(`vigente_hasta.is.null,vigente_hasta.gte.${today}`)
    .maybeSingle();

  if (error || !data) {
    return { clientType, isrRetencionPct: 0, ivaRetencionPct: 0, warning: null };
  }
  return {
    clientType,
    isrRetencionPct: Number(data.isr_retencion_pct),
    ivaRetencionPct: Number(data.iva_retencion_pct),
    warning: null,
  };
}
