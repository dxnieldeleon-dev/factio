// Resolves ISR/IVA withholding (retención) for an invoice: which rate
// applies given the issuer's tax_regime, the client's type, and the
// activity category. Runs server-side only — never trust a client-computed
// rate, same rule as the rest of the fiscal/billing enforcement in this
// codebase.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ClientType = "persona_fisica" | "persona_moral" | "plataforma_tecnologica";

export interface TaxTreatment {
  clientType: ClientType;
  isrRetencionPct: number; // e.g. 1.25 meaning 1.25%, not a 0-1 fraction
  ivaRetencionPct: number; // e.g. 10.6667 meaning 10.6667%
  warning: string | null;
}

type QueryableClient = SupabaseClient;

/**
 * Persona moral is always a 12-character RFC, persona física always 13.
 * Technology platforms (Uber/Didi/Airbnb-type) are persona moral by RFC too
 * — is_technology_platform is the only way to tell them apart, and it's a
 * manual flag on the client because there's no automatic signal for it.
 */
export function determineClientType(rfc: string, isTechnologyPlatform: boolean): ClientType {
  if (isTechnologyPlatform) return "plataforma_tecnologica";
  return rfc.trim().toUpperCase().length === 12 ? "persona_moral" : "persona_fisica";
}

async function resolvePlatformTreatment(
  supabase: QueryableClient,
  clientType: ClientType,
): Promise<TaxTreatment> {
  // platform_isr_brackets is deliberately unseeded (Art. 113-A LISR rates
  // are tiered by monthly income/activity type and republished yearly in
  // the LIF — see 20260731030000_platform_isr_brackets.sql). Bracket
  // selection by monthly income isn't implemented yet either way, so this
  // always resolves to "no retention" for now, but says so loudly instead
  // of pretending everything's fine.
  const { data, error } = await supabase
    .from("platform_isr_brackets")
    .select("id")
    .eq("is_active", true)
    .limit(1);

  if (error) {
    return {
      clientType,
      isrRetencionPct: 0,
      ivaRetencionPct: 0,
      warning: `Error consultando platform_isr_brackets: ${error.message}`,
    };
  }
  if (!data || data.length === 0) {
    return {
      clientType,
      isrRetencionPct: 0,
      ivaRetencionPct: 0,
      warning:
        "El cliente está marcado como plataforma tecnológica, pero platform_isr_brackets no tiene tarifas configuradas todavía (Art. 113-A LISR); no se aplicó retención automática.",
    };
  }
  return {
    clientType,
    isrRetencionPct: 0,
    ivaRetencionPct: 0,
    warning:
      "La selección automática de tarifa por plataforma tecnológica (por nivel de ingreso mensual) aún no está implementada; no se aplicó retención.",
  };
}

export async function resolveTaxTreatment(
  supabase: QueryableClient,
  params: {
    taxRegime: string | null;
    activityCategory: string | null;
    rfc: string;
    isTechnologyPlatform: boolean;
  },
): Promise<TaxTreatment> {
  const clientType = determineClientType(params.rfc, params.isTechnologyPlatform);

  if (clientType === "persona_fisica") {
    // Retention only ever applies when the payer is persona moral.
    return { clientType, isrRetencionPct: 0, ivaRetencionPct: 0, warning: null };
  }

  if (clientType === "plataforma_tecnologica") {
    return await resolvePlatformTreatment(supabase, clientType);
  }

  if (!params.taxRegime) {
    return {
      clientType,
      isrRetencionPct: 0,
      ivaRetencionPct: 0,
      warning: "No se pudo determinar el régimen fiscal del emisor; no se calculó retención.",
    };
  }

  // El emisor aún no tiene un activity_profile vinculado (el onboarding que
  // lo asigna todavía no existe) — servicios_profesionales es el default de
  // la columna activity_profiles.activity_category y, para las tasas
  // vigentes, es idéntico a arrendamiento en ambos regímenes, así que no
  // hay riesgo de aplicar una tasa incorrecta mientras tanto.
  const activityCategory = params.activityCategory ?? "servicios_profesionales";

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("tax_withholding_rules")
    .select("isr_retencion_pct, iva_retencion_pct")
    .eq("tax_regime", params.taxRegime)
    .eq("client_type", clientType)
    .eq("activity_category", activityCategory)
    .eq("is_active", true)
    .lte("vigente_desde", today)
    .or(`vigente_hasta.is.null,vigente_hasta.gte.${today}`)
    .maybeSingle();

  if (error) {
    return {
      clientType,
      isrRetencionPct: 0,
      ivaRetencionPct: 0,
      warning: `Error consultando tax_withholding_rules: ${error.message}`,
    };
  }
  if (!data) {
    return {
      clientType,
      isrRetencionPct: 0,
      ivaRetencionPct: 0,
      warning: `No hay regla de retención configurada para régimen ${params.taxRegime}, cliente ${clientType}, actividad ${activityCategory}.`,
    };
  }
  return {
    clientType,
    isrRetencionPct: Number(data.isr_retencion_pct),
    ivaRetencionPct: Number(data.iva_retencion_pct),
    warning: null,
  };
}
