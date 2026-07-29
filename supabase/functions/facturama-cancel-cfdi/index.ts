// Edge Function: facturama-cancel-cfdi
// Cancels an issued Multi-Issuer CFDI at Facturama before changing local state.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cancelCfdi } from "../_shared/facturama/client.ts";
import { isFacturamaError } from "../_shared/facturama/errors.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CANCELLATION_MOTIVES = new Set(["01", "02", "03", "04"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

function isCancelled(status: unknown) {
  return typeof status === "string" && /^(canceled|cancelled|cancelado)$/i.test(status.trim());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, reason: "Método no permitido." }, 405);

  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return json({ ok: false, reason: "No autenticado." }, 401);
  }
  const token = authHeader.slice(7).trim();
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey || !token)
    return json({ ok: false, reason: "Configuración incompleta." }, 500);

  const auth = createClient(url, anonKey);
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) return json({ ok: false, reason: "Sesión inválida." }, 401);

  let payload: { invoice_id?: unknown; motive?: unknown; uuid_replacement?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, reason: "Cuerpo de la petición inválido." }, 400);
  }
  if (typeof payload.invoice_id !== "string" || !UUID_PATTERN.test(payload.invoice_id)) {
    return json({ ok: false, reason: "invoice_id debe ser un UUID válido." }, 400);
  }
  if (typeof payload.motive !== "string" || !CANCELLATION_MOTIVES.has(payload.motive)) {
    return json({ ok: false, reason: "El motivo de cancelación no es válido." }, 400);
  }
  if (
    payload.motive === "01" &&
    (typeof payload.uuid_replacement !== "string" || !UUID_PATTERN.test(payload.uuid_replacement))
  ) {
    return json({ ok: false, reason: "El motivo 01 requiere el UUID del CFDI sustituto." }, 400);
  }

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, user_id, status, uuid_fiscal, pac_response")
    .eq("id", payload.invoice_id)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (invoiceError || !invoice) return json({ ok: false, reason: "Factura no encontrada." }, 404);
  if (invoice.status !== "issued" || !invoice.uuid_fiscal) {
    return json({ ok: false, reason: "Solo se pueden cancelar CFDI emitidos y vigentes." }, 409);
  }

  const pacResponse = invoice.pac_response;
  const facturamaId =
    pacResponse && typeof pacResponse === "object"
      ? (pacResponse as Record<string, unknown>).facturama_cfdi_id
      : null;
  if (typeof facturamaId !== "string" || !facturamaId) {
    return json(
      {
        ok: false,
        reason: "La factura no conserva el identificador de Facturama requerido para cancelarla.",
      },
      409,
    );
  }

  try {
    const cancellation = await cancelCfdi(
      facturamaId,
      payload.motive as "01" | "02" | "03" | "04",
      typeof payload.uuid_replacement === "string" ? payload.uuid_replacement : undefined,
    );
    const cancelled = isCancelled(cancellation.Status);
    const { error: updateError } = await supabase.rpc("finalize_cfdi_cancellation", {
      p_invoice_id: invoice.id,
      p_motive: payload.motive,
      p_uuid_replacement:
        typeof payload.uuid_replacement === "string" ? payload.uuid_replacement : null,
      p_cancelled: cancelled,
      p_request_date: cancelled ? null : (cancellation.RequestDate ?? new Date().toISOString()),
      p_cancelled_at: cancelled ? (cancellation.CancelationDate ?? new Date().toISOString()) : null,
      p_pac_response: cancellation,
    });
    if (updateError) {
      return json(
        {
          ok: false,
          reason: `Facturama procesó la cancelación, pero no se pudo guardar el resultado: ${updateError.message}`,
          facturama_response: cancellation,
        },
        502,
      );
    }

    return json({
      ok: true,
      cancelled,
      pending_acceptance: !cancelled,
      message:
        cancellation.Message ??
        (cancelled ? "CFDI cancelado correctamente." : "Solicitud de cancelación enviada al PAC."),
      facturama_response: cancellation,
    });
  } catch (error) {
    if (isFacturamaError(error)) {
      return json(
        {
          ok: false,
          reason: error.message,
          facturama_status: error.status,
          facturama_response: error.pacResponse,
        },
        error.status >= 500 ? 502 : error.status,
      );
    }
    const reason = error instanceof Error ? error.message : "No fue posible cancelar el CFDI.";
    return json({ ok: false, reason }, 502);
  }
});
