// Edge Function: facturama-cancel-cfdi
// Cancels an issued Multi-Issuer CFDI at Facturama before changing local state.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cancelCfdi, getCfdi } from "../_shared/facturama/client.ts";
import { isFacturamaError, userFacingPacMessage } from "../_shared/facturama/errors.ts";
import { notify } from "../_shared/notify.ts";

const allowedOrigin = Deno.env.get("APP_URL") ?? "https://factio.lovable.app";
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
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
    .select("id, user_id, status, uuid_fiscal, pac_response, series, folio")
    .eq("id", payload.invoice_id)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (invoiceError || !invoice) return json({ ok: false, reason: "Factura no encontrada." }, 404);
  if (invoice.status !== "issued" || !invoice.uuid_fiscal) {
    return json({ ok: false, reason: "Solo se pueden cancelar CFDI emitidos y vigentes." }, 409);
  }
  const folioLabel = `${invoice.series}-${String(invoice.folio).padStart(6, "0")}`;

  const pacResponse = invoice.pac_response;
  const facturamaId =
    pacResponse && typeof pacResponse === "object"
      ? (pacResponse as Record<string, unknown>).facturama_cfdi_id
      : null;
  if (typeof facturamaId !== "string" || !facturamaId) {
    return json(
      {
        ok: false,
        reason: "La factura no conserva el identificador del CFDI requerido para cancelarla.",
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
          reason: `Se procesó la cancelación, pero no se pudo guardar el resultado: ${updateError.message}`,
          facturama_response: cancellation,
        },
        502,
      );
    }

    if (cancelled) {
      await notify(supabase, {
        user_id: invoice.user_id,
        kind: "invoice_cancelled",
        title: `Factura ${folioLabel} cancelada`,
        body: "El SAT confirmó la cancelación de este comprobante.",
        link: `/invoices/${invoice.id}`,
        metadata: { invoice_id: invoice.id },
      });
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
    // Ambiguous outcome: the cancel request may have been applied at
    // Facturama's end even though the response we got back was an error
    // (network hiccup, sandbox flakiness, timeout after they'd already
    // processed it). Check the CFDI's real status before reporting failure
    // and leaving cancellation_status stuck at NULL forever.
    let reconciliationCheck: unknown;
    try {
      const current = await getCfdi(facturamaId);
      reconciliationCheck = { checked: true, status: (current as Record<string, unknown>).Status };
      if (isCancelled((current as Record<string, unknown>).Status)) {
        const { error: reconcileError } = await supabase.rpc("finalize_cfdi_cancellation", {
          p_invoice_id: invoice.id,
          p_motive: payload.motive,
          p_uuid_replacement:
            typeof payload.uuid_replacement === "string" ? payload.uuid_replacement : null,
          p_cancelled: true,
          p_request_date: null,
          p_cancelled_at: new Date().toISOString(),
          p_pac_response: current,
        });
        if (!reconcileError) {
          await notify(supabase, {
            user_id: invoice.user_id,
            kind: "invoice_cancelled",
            title: `Factura ${folioLabel} cancelada`,
            body: "El SAT confirmó la cancelación de este comprobante.",
            link: `/invoices/${invoice.id}`,
            metadata: { invoice_id: invoice.id },
          });
          return json({
            ok: true,
            cancelled: true,
            pending_acceptance: false,
            message: "El CFDI ya estaba cancelado ante el PAC; se sincronizó el estado.",
            facturama_response: current,
          });
        }
        reconciliationCheck = {
          ...(reconciliationCheck as Record<string, unknown>),
          finalize_error: reconcileError.message,
        };
      }
    } catch (reconcileCheckError) {
      // Couldn't verify either — fall through and report the original error,
      // but keep a record of why the check itself failed.
      reconciliationCheck = {
        checked: false,
        error: isFacturamaError(reconcileCheckError)
          ? { message: reconcileCheckError.message, status: reconcileCheckError.status }
          : String(reconcileCheckError),
      };
    }

    const errorPacResponse = {
      original_error: isFacturamaError(error)
        ? error.pacResponse
        : { message: error instanceof Error ? error.message : String(error) },
      reconciliation_check: reconciliationCheck,
    };
    try {
      await supabase.rpc("mark_cfdi_cancellation_error", {
        p_invoice_id: invoice.id,
        p_pac_response: errorPacResponse,
      });
    } catch {
      // Best-effort bookkeeping; never mask the original error below.
    }

    // El código de statuses de cancellation_status incluye 'rejected', pero
    // en el flujo real esta rama siempre deja cancellation_status en
    // 'error' (mark_cfdi_cancellation_error) — 'rejected' nunca se asigna
    // en el código actual. invoice_cancel_rejected cubre ambos casos: un
    // intento de cancelación que no se pudo confirmar.
    await notify(supabase, {
      user_id: invoice.user_id,
      kind: "invoice_cancel_rejected",
      title: `No se pudo cancelar la factura ${folioLabel}`,
      body: isFacturamaError(error)
        ? userFacingPacMessage(
            error,
            "Ocurrió un problema técnico al cancelar. Intenta de nuevo en unos minutos.",
          )
        : error instanceof Error
          ? error.message
          : "No fue posible cancelar el CFDI.",
      link: `/invoices/${invoice.id}`,
      metadata: { invoice_id: invoice.id },
    });

    if (isFacturamaError(error)) {
      return json(
        {
          ok: false,
          reason: userFacingPacMessage(
            error,
            "Ocurrió un problema técnico al cancelar tu comprobante. Intenta de nuevo en unos minutos.",
          ),
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
