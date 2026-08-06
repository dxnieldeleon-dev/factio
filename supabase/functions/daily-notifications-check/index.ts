// Edge Function: daily-notifications-check
// Tier 2 (time-based) notifications: revisa condiciones que dependen del
// paso del tiempo, no de un evento disparado por el usuario. Se dispara una
// vez al día desde pg_cron vía pg_net (ver migración
// 20260806040000_daily_notifications_cron.sql) — nunca desde un cliente.
//
// Solo acepta la llave service_role como credencial (nunca un JWT de
// usuario) y no lee ningún parámetro del body: la lógica es fija y no
// configurable por el llamador.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notify, type NotificationKind } from "../_shared/notify.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// Evita reenviar el mismo aviso en corridas sucesivas del cron: si ya existe
// una notificación de este `kind` (y, cuando aplica, del mismo
// metadata.company_id) dentro de la ventana, no se vuelve a insertar. Ante
// un error de lectura se asume "ya enviada" — mejor perder un aviso puntual
// que arriesgar spam si esta revisión falla.
async function hasRecentNotification(params: {
  userId: string;
  kind: NotificationKind;
  windowHours: number;
  companyId?: string;
}): Promise<boolean> {
  let query = admin
    .from("notifications")
    .select("id")
    .eq("user_id", params.userId)
    .eq("kind", params.kind)
    .gte("created_at", new Date(Date.now() - params.windowHours * HOUR_MS).toISOString());
  if (params.companyId) {
    query = query.eq("metadata->>company_id", params.companyId);
  }
  const { data, error } = await query.limit(1);
  if (error) {
    console.error("daily-notifications-check: fallo revisando duplicados", {
      kind: params.kind,
      error: error.message,
    });
    return true;
  }
  return (data?.length ?? 0) > 0;
}

const CSD_EXPIRY_THRESHOLDS: Array<{ days: number; kind: NotificationKind }> = [
  { days: 30, kind: "csd_expiring_30" },
  { days: 15, kind: "csd_expiring_15" },
  { days: 5, kind: "csd_expiring_5" },
];

// Días exactos (30/15/5), no "menor a" — así cada empresa recibe cada aviso
// una sola vez por umbral en vez de todos los días mientras esté vigente.
async function checkCsdExpiring(): Promise<number> {
  const { data: companies, error } = await admin
    .from("companies")
    .select("id, user_id, legal_name, csd_valid_to")
    .not("csd_valid_to", "is", null);
  if (error) {
    console.error("daily-notifications-check: fallo consultando CSD por vencer", error.message);
    return 0;
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let sent = 0;
  for (const company of companies ?? []) {
    const validTo = new Date(company.csd_valid_to as string);
    validTo.setUTCHours(0, 0, 0, 0);
    const daysLeft = Math.round((validTo.getTime() - today.getTime()) / DAY_MS);
    const threshold = CSD_EXPIRY_THRESHOLDS.find((t) => t.days === daysLeft);
    if (!threshold) continue;

    const alreadySent = await hasRecentNotification({
      userId: company.user_id,
      kind: threshold.kind,
      windowHours: 20,
      companyId: company.id,
    });
    if (alreadySent) continue;

    await notify(admin, {
      user_id: company.user_id,
      kind: threshold.kind,
      title: `Tu CSD vence en ${threshold.days} días`,
      body: `El certificado de sello digital de ${company.legal_name} vence el ${validTo.toLocaleDateString("es-MX")}. Renuévalo en el portal del SAT antes de esa fecha para no interrumpir tu facturación.`,
      link: "/profile/fiscal",
      metadata: { company_id: company.id },
    });
    sent++;
  }
  return sent;
}

// Recordatorio semanal (no diario) mientras el onboarding siga incompleto.
async function checkOnboardingIncomplete(): Promise<number> {
  const { data: companies, error } = await admin
    .from("companies")
    .select("id, user_id")
    .eq("onboarding_completed", false)
    .lt("created_at", new Date(Date.now() - 48 * HOUR_MS).toISOString());
  if (error) {
    console.error(
      "daily-notifications-check: fallo consultando onboarding incompleto",
      error.message,
    );
    return 0;
  }

  let sent = 0;
  for (const company of companies ?? []) {
    const alreadySent = await hasRecentNotification({
      userId: company.user_id,
      kind: "onboarding_incomplete",
      windowHours: 7 * 24,
      companyId: company.id,
    });
    if (alreadySent) continue;

    await notify(admin, {
      user_id: company.user_id,
      kind: "onboarding_incomplete",
      title: "Termina de configurar tu cuenta en Factio",
      body: "Te faltan algunos datos para poder timbrar tus facturas. Termina tu configuración cuando puedas.",
      link: "/onboarding",
      metadata: { company_id: company.id },
    });
    sent++;
  }
  return sent;
}

// "20-30 días sin facturar": se dispara al cruzar los 20 días y se
// re-verifica cada 15 para no repetir el aviso a diario mientras la
// inactividad continúa.
async function checkInactivity(): Promise<number> {
  const { data: companies, error: companiesError } = await admin
    .from("companies")
    .select("id, user_id, created_at")
    .eq("onboarding_completed", true);
  if (companiesError) {
    console.error(
      "daily-notifications-check: fallo consultando companies para inactividad",
      companiesError.message,
    );
    return 0;
  }
  if (!companies?.length) return 0;

  const { data: issuedInvoices, error: invoicesError } = await admin
    .from("invoices")
    .select("company_id, issued_at")
    .eq("status", "issued")
    .in(
      "company_id",
      companies.map((c) => c.id),
    )
    .order("issued_at", { ascending: false });
  if (invoicesError) {
    console.error(
      "daily-notifications-check: fallo consultando invoices para inactividad",
      invoicesError.message,
    );
    return 0;
  }

  // El primer registro visto por company_id es el más reciente (orden
  // descendente arriba) — equivalente a MAX(issued_at) sin necesitar GROUP BY.
  const lastIssuedByCompany = new Map<string, string>();
  for (const invoice of issuedInvoices ?? []) {
    if (!invoice.company_id || !invoice.issued_at) continue;
    if (!lastIssuedByCompany.has(invoice.company_id)) {
      lastIssuedByCompany.set(invoice.company_id, invoice.issued_at);
    }
  }

  const twentyDaysAgo = Date.now() - 20 * DAY_MS;
  let sent = 0;
  for (const company of companies) {
    const lastIssuedAt = lastIssuedByCompany.get(company.id);
    // Nunca ha facturado: solo cuenta como "inactivo" si ya lleva 20+ días
    // desde que se dio de alta — evita avisar el día 1 a una cuenta nueva
    // que apenas terminó el onboarding y todavía no tuvo oportunidad de emitir nada.
    const isInactive = lastIssuedAt
      ? new Date(lastIssuedAt).getTime() < twentyDaysAgo
      : new Date(company.created_at).getTime() < twentyDaysAgo;
    if (!isInactive) continue;

    const alreadySent = await hasRecentNotification({
      userId: company.user_id,
      kind: "inactivity_reminder",
      windowHours: 15 * 24,
      companyId: company.id,
    });
    if (alreadySent) continue;

    await notify(admin, {
      user_id: company.user_id,
      kind: "inactivity_reminder",
      title: "No has facturado en un tiempo",
      body: "Cuando quieras, aquí está Factio para tu próxima factura.",
      link: "/invoices/new",
      metadata: { company_id: company.id },
    });
    sent++;
  }
  return sent;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ ok: false, reason: "Método no permitido." }, 405);
  }

  // Único mecanismo de autorización: la llave service_role exacta. No se
  // acepta ningún JWT de usuario (aunque sea válido) ni ningún parámetro del
  // body — este job no es configurable por quien lo invoque.
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const token = authHeader?.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (token !== serviceRoleKey) {
    return json({ ok: false, reason: "No autorizado." }, 401);
  }

  try {
    const [csdExpiring, onboardingIncomplete, inactivity] = await Promise.all([
      checkCsdExpiring(),
      checkOnboardingIncomplete(),
      checkInactivity(),
    ]);

    const summary = {
      csd_expiring: csdExpiring,
      onboarding_incomplete: onboardingIncomplete,
      inactivity_reminder: inactivity,
    };
    console.log("daily-notifications-check: resumen", summary);
    return json({ ok: true, summary });
  } catch (error) {
    console.error("daily-notifications-check: fallo inesperado", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return json({ ok: false, reason: "Error inesperado ejecutando las revisiones." }, 500);
  }
});
