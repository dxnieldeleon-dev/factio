// Extrae, de forma heurística y "mejor esfuerzo", los datos fiscales y la
// actividad económica desde el texto plano de una Constancia de Situación
// Fiscal del SAT. Todo lo que produce este módulo es una SUGERENCIA que se
// muestra en campos editables del formulario de onboarding — nunca se guarda
// directo, el usuario siempre revisa/corrige antes de continuar, y la
// validación existente del formulario (validateStepA) sigue siendo la que
// finalmente decide si los datos son válidos.

import { supabase } from "@/integrations/supabase/client";
import { TAX_REGIMES } from "./sat-catalogs";

export interface ParsedConstancia {
  rfc: string | null;
  legalName: string | null;
  postalCode: string | null;
  taxRegimeCode: string | null;
  activityText: string | null;
}

export interface ActivityMatch {
  id: string;
  name: string;
}

// Convierte a mayúsculas sin acentos y sustituye toda la puntuación por
// espacios, para que "Nombre (s):" y "Denominación/Razón Social:" se vuelvan
// tokens de búsqueda estables ("NOMBRE S", "DENOMINACION RAZON SOCIAL") sin
// tener que cubrir cada variante de espaciado/puntuación a mano.
function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const RFC_PATTERN = /([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})/;

const KNOWN_LABELS = [
  "RFC",
  "CURP",
  "NOMBRE S",
  "PRIMER APELLIDO",
  "SEGUNDO APELLIDO",
  "DENOMINACION RAZON SOCIAL",
  "REGIMEN CAPITAL",
  "FECHA DE INICIO DE OPERACIONES",
  "ESTATUS EN EL PADRON",
  "FECHA DE ULTIMO CAMBIO DE ESTADO",
  "CODIGO POSTAL",
  "TIPO DE VIALIDAD",
  "NOMBRE DE VIALIDAD",
  "NUMERO EXTERIOR",
  "NUMERO INTERIOR",
  "NOMBRE DE LA COLONIA",
  "NOMBRE DE LA LOCALIDAD",
  "NOMBRE DEL MUNICIPIO O DELEGACION",
  "NOMBRE DE LA ENTIDAD FEDERATIVA",
  "ENTRE CALLE",
  "Y CALLE",
  "REGIMENES",
  "REGIMEN",
  "ACTIVIDADES ECONOMICAS",
  "ACTIVIDAD ECONOMICA",
  "OBLIGACIONES",
];

// Captura el texto entre una etiqueta conocida y la siguiente etiqueta
// conocida que aparezca después — así no hay que adivinar dónde termina cada
// campo, basta con saber dónde empieza el siguiente.
function captureField(norm: string, label: string, maxLength = 120): string | null {
  const idx = norm.indexOf(label);
  if (idx === -1) return null;
  const start = idx + label.length;
  let end = norm.length;
  for (const other of KNOWN_LABELS) {
    if (other === label) continue;
    const otherIdx = norm.indexOf(other, start);
    if (otherIdx !== -1 && otherIdx < end) end = otherIdx;
  }
  const slice = norm.slice(start, Math.min(end, start + maxLength)).trim();
  return slice || null;
}

function extractRfc(norm: string): string | null {
  const afterLabel = captureField(norm, "RFC", 20);
  const labeled = afterLabel ? RFC_PATTERN.exec(afterLabel) : null;
  if (labeled) return labeled[1];
  const bare = RFC_PATTERN.exec(norm);
  return bare ? bare[1] : null;
}

function extractPostalCode(norm: string): string | null {
  const captured = captureField(norm, "CODIGO POSTAL", 10);
  const m = captured ? /(\d{5})/.exec(captured) : null;
  return m ? m[1] : null;
}

function extractLegalName(norm: string): string | null {
  const moral = captureField(norm, "DENOMINACION RAZON SOCIAL", 150);
  if (moral) return moral;

  const apellidoPaterno = captureField(norm, "PRIMER APELLIDO", 60);
  const apellidoMaterno = captureField(norm, "SEGUNDO APELLIDO", 60);
  const nombres = captureField(norm, "NOMBRE S", 60);
  // Orden "natural" (nombre primero) para que coincida con el resto del
  // formulario, p.ej. el placeholder "JUAN PEREZ LOPEZ" — no el orden en que
  // el SAT imprime las columnas en la constancia.
  const parts = [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

// Alias por régimen: el texto exacto que imprime el SAT en la constancia no
// siempre coincide palabra por palabra con TAX_REGIMES, así que se ubica por
// las frases más distintivas de cada régimen en vez de un match exacto.
const REGIME_ALIASES: Record<string, string[]> = {
  "626": ["SIMPLIFICADO DE CONFIANZA", "RESICO"],
  "612": ["ACTIVIDADES EMPRESARIALES Y PROFESIONALES"],
  "606": ["ARRENDAMIENTO"],
  "605": ["SUELDOS Y SALARIOS"],
  "601": ["GENERAL DE LEY PERSONAS MORALES"],
  "603": ["PERSONAS MORALES CON FINES NO LUCRATIVOS"],
  "621": ["INCORPORACION FISCAL"],
  "625": ["PLATAFORMAS TECNOLOGICAS"],
  "608": ["DEMAS INGRESOS"],
  "616": ["SIN OBLIGACIONES FISCALES"],
};

function extractTaxRegime(norm: string): string | null {
  for (const regime of TAX_REGIMES) {
    const aliases = REGIME_ALIASES[regime.code];
    if (aliases?.some((alias) => norm.includes(alias))) return regime.code;
  }
  return null;
}

function extractActivityText(norm: string): string | null {
  const start =
    norm.indexOf("ACTIVIDADES ECONOMICAS") !== -1
      ? norm.indexOf("ACTIVIDADES ECONOMICAS") + "ACTIVIDADES ECONOMICAS".length
      : norm.indexOf("ACTIVIDAD ECONOMICA") !== -1
        ? norm.indexOf("ACTIVIDAD ECONOMICA") + "ACTIVIDAD ECONOMICA".length
        : -1;
  if (start === -1) return null;
  const stopIdx = norm.indexOf("OBLIGACIONES", start);
  const end = stopIdx !== -1 ? stopIdx : Math.min(norm.length, start + 400);
  const slice = norm.slice(start, end).trim();
  return slice || null;
}

export function parseConstanciaText(rawText: string): ParsedConstancia {
  const norm = normalize(rawText);
  return {
    rfc: extractRfc(norm),
    legalName: extractLegalName(norm),
    postalCode: extractPostalCode(norm),
    taxRegimeCode: extractTaxRegime(norm),
    activityText: extractActivityText(norm),
  };
}

const STOPWORDS = new Set([
  "DE",
  "DEL",
  "LA",
  "LAS",
  "EL",
  "LOS",
  "Y",
  "E",
  "EN",
  "A",
  "PARA",
  "CON",
  "SU",
  "SUS",
  "O",
  "U",
  "AL",
  "POR",
  "QUE",
]);

function significantWords(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((word) => word.length > 3 && !STOPWORDS.has(word));
}

function scoreOverlap(haystack: Set<string>, words: string[]): number {
  let score = 0;
  for (const word of words) if (haystack.has(word)) score++;
  return score;
}

// Intenta emparejar el texto de "Actividades Económicas" contra el catálogo
// SCIAN verificado primero (más confiable cuando hay match) y, si no
// encuentra nada, contra los nombres/descripciones de activity_profiles
// directamente. Nunca se guarda automáticamente — solo se usa para
// preseleccionar el <select> de actividad, que el usuario puede cambiar.
export async function matchActivityProfile(
  activityText: string | null,
): Promise<ActivityMatch | null> {
  if (!activityText) return null;
  const haystack = new Set(significantWords(activityText));
  if (haystack.size === 0) return null;

  const [{ data: scianRows }, { data: profiles }] = await Promise.all([
    supabase.from("sat_economic_activities").select("description, activity_profile_id"),
    supabase.from("activity_profiles").select("id, name, description").eq("is_active", true),
  ]);

  const profileNameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  let best: { id: string; name: string; score: number } | null = null;

  for (const row of scianRows ?? []) {
    if (!row.activity_profile_id) continue;
    const words = significantWords(row.description);
    const score = scoreOverlap(haystack, words);
    if (score > 0 && score >= Math.min(2, words.length)) {
      const name = profileNameById.get(row.activity_profile_id);
      if (name && (!best || score > best.score)) {
        best = { id: row.activity_profile_id, name, score };
      }
    }
  }
  if (best) return { id: best.id, name: best.name };

  for (const profile of profiles ?? []) {
    const words = significantWords(`${profile.name} ${profile.description ?? ""}`);
    const score = scoreOverlap(haystack, words);
    if (score >= 2 && (!best || score > best.score)) {
      best = { id: profile.id, name: profile.name, score };
    }
  }
  return best ? { id: best.id, name: best.name } : null;
}
