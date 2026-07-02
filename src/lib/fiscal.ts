// Utilidades fiscales para CFDI 4.0
// - Normalización de nombre fiscal según constancia de situación fiscal (SAT)
// - RFC genéricos nacional / extranjero
// - Validación de perfil receptor (retorna errores por campo)

import { isCfdiUseCompatible } from "./sat-catalogs";

export const RFC_GENERIC_NATIONAL = "XAXX010101000";
export const RFC_GENERIC_FOREIGN = "XEXX010101000";

const RFC_PATTERN = /^([A-ZÑ&]{3,4})(\d{6})([A-Z\d]{3})$/;

/**
 * Normaliza el nombre fiscal como lo espera el SAT en la constancia:
 * mayúsculas, sin acentos, sin régimen de capital (S.A. de C.V., etc.),
 * espacios colapsados.
 */
export function normalizeFiscalName(input: string): string {
  if (!input) return "";
  let s = input.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // quita acentos
  s = s.toUpperCase();
  // Elimina régimen de capital común
  s = s.replace(
    /\b(S\.?\s?A\.?\s?(DE\s?C\.?\s?V\.?)?|S\.?\s?DE\s?R\.?\s?L\.?(\s?DE\s?C\.?\s?V\.?)?|S\.?\s?C\.?|A\.?\s?C\.?|S\.?\s?A\.?\s?P\.?\s?I\.?(\s?DE\s?C\.?\s?V\.?)?|S\.?\s?A\.?\s?B\.?(\s?DE\s?C\.?\s?V\.?)?)\.?$/g,
    "",
  );
  s = s.replace(/[.,]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export type RfcKind = "physical" | "moral" | "generic_national" | "generic_foreign" | "invalid";

export function classifyRfc(rfc: string): RfcKind {
  const v = (rfc ?? "").trim().toUpperCase();
  if (v === RFC_GENERIC_NATIONAL) return "generic_national";
  if (v === RFC_GENERIC_FOREIGN) return "generic_foreign";
  if (!RFC_PATTERN.test(v)) return "invalid";
  const nameLen = v.length === 13 ? 4 : 3;
  return nameLen === 4 ? "physical" : "moral";
}

export function validateRfcStrict(rfc: string): { valid: boolean; reason?: string; kind: RfcKind } {
  const v = (rfc ?? "").trim().toUpperCase();
  if (!v) return { valid: false, reason: "El RFC es obligatorio.", kind: "invalid" };
  if (v.length < 12 || v.length > 13) return { valid: false, reason: "El RFC debe tener 12 (moral) o 13 caracteres (física).", kind: "invalid" };
  const kind = classifyRfc(v);
  if (kind === "invalid") return { valid: false, reason: "Formato de RFC no válido. Revisa letras y fecha (AAMMDD).", kind };
  return { valid: true, kind };
}

export interface ReceiverProfile {
  rfc: string;
  legal_name: string;
  tax_regime: string | null;
  postal_code: string | null;
  cfdi_use: string | null;
}

export type FieldErrors = Partial<Record<"rfc" | "legal_name" | "tax_regime" | "postal_code" | "cfdi_use", string>>;

/**
 * Reglas CFDI 4.0 para el receptor:
 * - RFC genérico nacional (XAXX010101000): CP debe coincidir con el emisor,
 *   uso CFDI típico "S01" (Sin efectos fiscales), régimen 616.
 * - RFC genérico extranjero (XEXX010101000): régimen 616, CP del emisor, uso S01.
 * - RFC normal: régimen y CP obligatorios; uso CFDI compatible con el régimen.
 */
export function validateReceiverProfile(
  p: ReceiverProfile,
  issuerPostalCode?: string | null,
): FieldErrors {
  const errors: FieldErrors = {};
  const rfcCheck = validateRfcStrict(p.rfc);
  if (!rfcCheck.valid) errors.rfc = rfcCheck.reason;

  if (!p.legal_name?.trim()) {
    errors.legal_name = "Escribe el nombre o razón social tal como aparece en la constancia.";
  }

  if (!p.postal_code || !/^\d{5}$/.test(p.postal_code.trim())) {
    errors.postal_code = "El código postal debe ser de 5 dígitos.";
  }

  const kind = rfcCheck.kind;
  if (kind === "generic_national" || kind === "generic_foreign") {
    // Régimen debe ser 616 y uso S01 (Sin efectos fiscales)
    if (p.tax_regime && p.tax_regime !== "616") {
      errors.tax_regime = "Con RFC genérico el régimen debe ser 616 (Sin obligaciones fiscales).";
    }
    if (p.cfdi_use && p.cfdi_use !== "S01") {
      errors.cfdi_use = "Con RFC genérico el uso CFDI debe ser S01 (Sin efectos fiscales).";
    }
    if (issuerPostalCode && p.postal_code && p.postal_code !== issuerPostalCode) {
      errors.postal_code = `Con RFC genérico el CP debe ser el del emisor (${issuerPostalCode}).`;
    }
  } else if (rfcCheck.valid) {
    if (!p.tax_regime) errors.tax_regime = "Selecciona el régimen fiscal del receptor.";
    if (!p.cfdi_use) errors.cfdi_use = "Selecciona el uso CFDI.";
    if (p.tax_regime && p.cfdi_use && !isCfdiUseCompatible(p.tax_regime, p.cfdi_use)) {
      errors.cfdi_use = "Este uso CFDI no es compatible con el régimen fiscal del receptor.";
    }
    // Régimen 605 (Sueldos y Salarios) sólo admite algunos usos particulares → ya validado por matriz.
  }

  return errors;
}

export function hasErrors(e: FieldErrors): boolean {
  return Object.keys(e).length > 0;
}

/**
 * Reglas simples para forma vs método de pago.
 * PPD (pago diferido) siempre debe llevar forma 99 (Por definir).
 */
export function validatePayment(method: string, form: string): string | null {
  if (method === "PPD" && form !== "99") {
    return "Para pagos en parcialidades (PPD) la forma de pago debe ser 99 (Por definir).";
  }
  if (method === "PUE" && form === "99") {
    return "Para pago en una sola exhibición (PUE) la forma de pago no puede ser 99.";
  }
  return null;
}
