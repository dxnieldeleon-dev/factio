// Edge Function: facturama-create-cfdi
// Orquesta el timbrado de una factura registrada en Factio.
// El cliente solo envía invoice_id; los datos fiscales se obtienen en servidor.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createCfdi,
  documentBase64,
  downloadCfdi,
  getCfdi,
  getCfdiId,
  getCfdiUuid,
} from "../_shared/facturama/client.ts";
import {
  CfdiWorkflowError,
  isCfdiWorkflowError,
  isFacturamaError,
} from "../_shared/facturama/errors.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "content-type": "application/json",
    },
  });
}

type SupabaseCredentials = {
  url: string;
  anonKey: string;
};

type AuthenticatedUser = {
  id: string;
  accessToken: string;
};

type InvoiceContext = {
  invoice: Record<string, unknown>;
  company: Record<string, unknown>;
  client: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
};

type FacturamaCfdiPayload = {
  Currency: string;
  CurrencyExchangeRate?: number;
  ExpeditionPlace: string;
  Exportation: string;
  Folio: string;
  Serie: string;
  CfdiType: "I";
  PaymentForm: string;
  PaymentMethod: "PUE" | "PPD";
  Issuer: {
    Rfc: string;
    Name: string;
    FiscalRegime: string;
  };
  Receiver: {
    Rfc: string;
    Name: string;
    CfdiUse: string;
    FiscalRegime: string;
    TaxZipCode: string;
  };
  Items: Array<{
    ProductCode: string;
    Description: string;
    UnitCode: string;
    UnitPrice: number;
    Quantity: number;
    Subtotal: number;
    Discount: number;
    TaxObject: "02";
    Taxes: Array<{
      Name: "IVA";
      Base: number;
      Rate: number;
      IsRetention: false;
      IsQuota: false;
      Total: number;
    }>;
    Total: number;
  }>;
};

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function valuesMatch(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.01;
}

function invoiceMetadata(notes: unknown) {
  const entries = (asText(notes) ?? "").split(";");
  const values = new Map(
    entries.map((entry) => entry.split("=", 2)).filter(([key, value]) => Boolean(key && value)),
  );

  return {
    cfdiType: values.get("cfdi_type") ?? "I",
    exportation: values.get("export") ?? "01",
  };
}

function buildCfdiPayload(context: InvoiceContext): FacturamaCfdiPayload | Response {
  const issuerRfc = asText(context.company.rfc)?.toUpperCase();
  const issuerName = asText(context.company.legal_name);
  const issuerRegime = asText(context.company.tax_regime);
  const expeditionPlace = asText(context.company.postal_code);
  const receiverRfc = asText(context.client.rfc)?.toUpperCase();
  const receiverName = asText(context.client.legal_name);
  const snapshot = context.invoice.client_snapshot;
  const receiverSnapshot =
    snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? (snapshot as Record<string, unknown>)
      : null;
  const receiverFiscalName = asText(receiverSnapshot?.legal_name) ?? receiverName;
  const receiverRegime = asText(receiverSnapshot?.tax_regime) ?? asText(context.client.tax_regime);
  const receiverPostalCode =
    asText(receiverSnapshot?.postal_code) ?? asText(context.client.postal_code);
  const cfdiUse =
    asText(context.invoice.cfdi_use) ??
    asText(receiverSnapshot?.cfdi_use) ??
    asText(context.client.cfdi_use);

  if (
    !issuerRfc ||
    !issuerName ||
    !issuerRegime ||
    !expeditionPlace ||
    !receiverRfc ||
    !receiverFiscalName ||
    !receiverRegime ||
    !receiverPostalCode ||
    !cfdiUse
  ) {
    return json({ ok: false, reason: "Faltan datos fiscales obligatorios para el CFDI." }, 400);
  }
  if (!/^\d{5}$/.test(expeditionPlace) || !/^\d{5}$/.test(receiverPostalCode)) {
    return json({ ok: false, reason: "El código postal fiscal debe tener 5 dígitos." }, 400);
  }

  const { cfdiType, exportation } = invoiceMetadata(context.invoice.notes);
  if (cfdiType !== "I") {
    return json({ ok: false, reason: "Por ahora solo se pueden timbrar CFDI de ingreso." }, 400);
  }
  if (!/^0[1-4]$/.test(exportation)) {
    return json({ ok: false, reason: "La clave de exportación no es válida." }, 400);
  }

  const paymentMethod = asText(context.invoice.payment_method);
  const paymentForm = asText(context.invoice.payment_form);
  const currency = asText(context.invoice.currency);
  const series = asText(context.invoice.series);
  const folio = asNumber(context.invoice.folio);
  const exchangeRate = asNumber(context.invoice.exchange_rate);
  if (
    (paymentMethod !== "PUE" && paymentMethod !== "PPD") ||
    !paymentForm ||
    !currency ||
    !series ||
    !folio ||
    !exchangeRate ||
    exchangeRate <= 0
  ) {
    return json({ ok: false, reason: "La factura contiene datos de pago incompletos." }, 400);
  }
  if (paymentMethod === "PPD" && paymentForm !== "99") {
    return json({ ok: false, reason: "Un CFDI PPD debe usar la forma de pago 99." }, 400);
  }

  let subtotal = 0;
  let ivaTotal = 0;
  const items: FacturamaCfdiPayload["Items"] = [];
  for (const item of context.items) {
    const productCode = asText(item.sat_key);
    const unitCode = asText(item.sat_unit);
    const description = asText(item.description);
    const quantity = asNumber(item.quantity);
    const unitPrice = asNumber(item.unit_price);
    const discount = asNumber(item.discount) ?? 0;
    const ivaRate = asNumber(item.iva_rate);
    if (
      !productCode ||
      !unitCode ||
      !description ||
      quantity === null ||
      unitPrice === null ||
      ivaRate === null ||
      quantity <= 0 ||
      unitPrice < 0 ||
      discount < 0 ||
      ivaRate < 0
    ) {
      return json({ ok: false, reason: "Uno o más conceptos son inválidos." }, 400);
    }

    const lineSubtotal = toMoney(quantity * unitPrice - discount);
    if (lineSubtotal < 0) {
      return json({ ok: false, reason: "El descuento no puede exceder el importe." }, 400);
    }
    const lineIva = toMoney(lineSubtotal * ivaRate);
    subtotal = toMoney(subtotal + lineSubtotal);
    ivaTotal = toMoney(ivaTotal + lineIva);
    items.push({
      ProductCode: productCode,
      Description: description,
      UnitCode: unitCode,
      UnitPrice: unitPrice,
      Quantity: quantity,
      Subtotal: lineSubtotal,
      Discount: discount,
      TaxObject: "02",
      Taxes: [
        {
          Name: "IVA",
          Base: lineSubtotal,
          Rate: ivaRate,
          IsRetention: false,
          IsQuota: false,
          Total: lineIva,
        },
      ],
      Total: toMoney(lineSubtotal + lineIva),
    });
  }

  const storedSubtotal = asNumber(context.invoice.subtotal);
  const storedIva = asNumber(context.invoice.iva_total);
  const storedTotal = asNumber(context.invoice.total);
  const total = toMoney(subtotal + ivaTotal);
  if (
    storedSubtotal === null ||
    storedIva === null ||
    storedTotal === null ||
    !valuesMatch(storedSubtotal, subtotal) ||
    !valuesMatch(storedIva, ivaTotal) ||
    !valuesMatch(storedTotal, total)
  ) {
    return json(
      { ok: false, reason: "Los totales guardados no coinciden con los conceptos." },
      409,
    );
  }

  return {
    Currency: currency,
    ...(currency === "MXN" ? {} : { CurrencyExchangeRate: exchangeRate }),
    ExpeditionPlace: expeditionPlace,
    Exportation: exportation,
    Folio: String(folio),
    Serie: series,
    CfdiType: "I",
    PaymentForm: paymentForm,
    PaymentMethod: paymentMethod,
    Issuer: { Rfc: issuerRfc, Name: issuerName, FiscalRegime: issuerRegime },
    Receiver: {
      Rfc: receiverRfc,
      Name: receiverFiscalName,
      CfdiUse: cfdiUse,
      FiscalRegime: receiverRegime,
      TaxZipCode: receiverPostalCode,
    },
    Items: items,
  };
}

function getSupabaseCredentials(): SupabaseCredentials | Response {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!url || !anonKey) {
    console.error("Supabase authentication environment is not configured");
    return json({ ok: false, reason: "Configuración de autenticación incompleta." }, 500);
  }

  return { url, anonKey };
}

function createUserScopedClient(credentials: SupabaseCredentials, accessToken: string) {
  return createClient(credentials.url, credentials.anonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/\s/g, ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function cfdiDocumentPath(userId: string, invoiceId: string, extension: "xml" | "pdf") {
  return `${userId}/${invoiceId}.${extension}`;
}

async function storeCfdiDocument(
  user: AuthenticatedUser,
  invoiceId: string,
  extension: "xml" | "pdf",
  contentBase64: string,
): Promise<string | Response> {
  const credentials = getSupabaseCredentials();
  if (credentials instanceof Response) return credentials;

  const path = cfdiDocumentPath(user.id, invoiceId, extension);
  const supabase = createUserScopedClient(credentials, user.accessToken);
  const { error } = await supabase.storage
    .from("cfdi-documents")
    .upload(path, base64ToBytes(contentBase64), {
      contentType: extension === "xml" ? "application/xml" : "application/pdf",
      upsert: true,
    });

  if (error) {
    console.error("Unable to store CFDI document", { invoiceId, extension, error: error.message });
    return json(
      {
        ok: false,
        reason: `No fue posible guardar el archivo ${extension.toUpperCase()} del CFDI.`,
      },
      502,
    );
  }
  return path;
}

async function removeStoredCfdiDocuments(user: AuthenticatedUser, invoiceId: string) {
  const credentials = getSupabaseCredentials();
  if (credentials instanceof Response) return;
  const supabase = createUserScopedClient(credentials, user.accessToken);
  await supabase.storage
    .from("cfdi-documents")
    .remove([
      cfdiDocumentPath(user.id, invoiceId, "xml"),
      cfdiDocumentPath(user.id, invoiceId, "pdf"),
    ]);
}

async function markStampForReconciliation(
  user: AuthenticatedUser,
  invoiceId: string,
  error: unknown,
  cfdiId: string | null = null,
) {
  const credentials = getSupabaseCredentials();
  if (credentials instanceof Response) return;
  const supabase = createUserScopedClient(credentials, user.accessToken);
  const message =
    error instanceof Error ? error.message : "No fue posible confirmar el resultado del timbrado.";
  // Cuando ya tenemos el identificador del CFDI en Facturama (la solicitud de
  // timbrado sí llegó a buen puerto y falló un paso posterior), lo guardamos
  // para que la reconciliación pueda recuperar el CFDI sin volver a adivinar.
  const pacResponse =
    cfdiId || isFacturamaError(error) || isCfdiWorkflowError(error)
      ? {
          facturama_cfdi_id: cfdiId,
          raw_error_response:
            isFacturamaError(error) || isCfdiWorkflowError(error) ? error.pacResponse : null,
        }
      : null;
  const { error: updateError } = await supabase.rpc("mark_cfdi_stamp_reconciliation_required", {
    p_invoice_id: invoiceId,
    p_error: message,
    p_pac_response: pacResponse,
  });
  if (updateError) {
    console.error("Unable to mark CFDI for reconciliation", {
      invoiceId,
      error: updateError.message,
    });
  }
}

async function releaseStampClaim(user: AuthenticatedUser, invoiceId: string, error: Error) {
  const credentials = getSupabaseCredentials();
  if (credentials instanceof Response) return;
  const supabase = createUserScopedClient(credentials, user.accessToken);
  const { error: updateError } = await supabase.rpc("release_cfdi_stamp_claim", {
    p_invoice_id: invoiceId,
    p_error: error.message,
  });
  if (updateError) {
    console.error("Unable to release CFDI stamp claim", { invoiceId, error: updateError.message });
  }
}

function integrationErrorResponse(error: unknown): Response {
  if (isFacturamaError(error)) {
    console.error("Facturama CFDI request failed", {
      status: error.status,
      pacResponse: error.pacResponse,
      message: error.message,
    });
    return json(
      {
        ok: false,
        stamped: false,
        reason: error.message,
        facturama_status: error.status,
        facturama_response: error.pacResponse,
      },
      error.status >= 500 ? 502 : error.status,
    );
  }

  if (isCfdiWorkflowError(error)) {
    console.error("CFDI workflow failed", {
      status: error.status,
      pacResponse: error.pacResponse,
      message: error.message,
    });
    return json(
      {
        ok: false,
        stamped: false,
        reason: error.message,
        facturama_status: null,
        facturama_response: error.pacResponse,
      },
      error.status,
    );
  }

  const message =
    error instanceof Error ? error.message : "Error no identificable al finalizar el timbrado.";
  console.error("CFDI finalization failed", { message });
  return json({ ok: false, stamped: false, reason: message }, 500);
}

async function authenticateRequest(req: Request): Promise<AuthenticatedUser | Response> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ ok: false, reason: "No autenticado." }, 401);
  }

  const accessToken = authHeader.slice(7).trim();
  if (!accessToken) {
    return json({ ok: false, reason: "Token inválido." }, 401);
  }

  const credentials = getSupabaseCredentials();
  if (credentials instanceof Response) return credentials;

  const supabase = createClient(credentials.url, credentials.anonKey);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return json({ ok: false, reason: "Sesión inválida o expirada." }, 401);
  }

  return { id: user.id, accessToken };
}

async function loadInvoiceContext(
  user: AuthenticatedUser,
  invoiceId: string,
): Promise<InvoiceContext | Response> {
  const credentials = getSupabaseCredentials();
  if (credentials instanceof Response) return credentials;

  // Las consultas conservan el JWT del usuario: RLS y el filtro explícito de
  // user_id son defensas complementarias para impedir acceso entre cuentas.
  const supabase = createUserScopedClient(credentials, user.accessToken);
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select(
      "id, user_id, company_id, client_id, client_snapshot, series, folio, status, payment_method, payment_form, cfdi_use, currency, exchange_rate, subtotal, discount, iva_total, retentions_total, total, notes",
    )
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (invoiceError) {
    console.error("Unable to load invoice", invoiceError.message);
    return json({ ok: false, reason: "No fue posible obtener la factura." }, 500);
  }
  if (!invoice) {
    return json({ ok: false, reason: "Factura no encontrada." }, 404);
  }
  if (!invoice.company_id || !invoice.client_id) {
    return json({ ok: false, reason: "La factura no tiene emisor o receptor configurado." }, 400);
  }

  const [companyResult, clientResult, itemsResult] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "id, user_id, legal_name, rfc, tax_regime, postal_code, csd_cer_url, csd_key_url, csd_serial_number, csd_valid_to",
      )
      .eq("id", invoice.company_id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("id, user_id, legal_name, rfc, tax_regime, postal_code, cfdi_use")
      .eq("id", invoice.client_id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("invoice_items")
      .select(
        "id, invoice_id, user_id, sat_key, sat_unit, description, quantity, unit_price, discount, iva_rate, iva_amount, amount, position",
      )
      .eq("invoice_id", invoice.id)
      .eq("user_id", user.id)
      .order("position", { ascending: true }),
  ]);

  if (companyResult.error || clientResult.error || itemsResult.error) {
    console.error("Unable to load invoice dependencies", {
      company: companyResult.error?.message,
      client: clientResult.error?.message,
      items: itemsResult.error?.message,
    });
    return json({ ok: false, reason: "No fue posible obtener los datos fiscales." }, 500);
  }
  if (!companyResult.data || !clientResult.data) {
    return json({ ok: false, reason: "El emisor o receptor ya no está disponible." }, 409);
  }
  if (!itemsResult.data?.length) {
    return json({ ok: false, reason: "La factura no contiene conceptos." }, 400);
  }

  return {
    invoice,
    company: companyResult.data,
    client: clientResult.data,
    items: itemsResult.data,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }
  if (req.method !== "POST") {
    return json({ ok: false, reason: "Método no permitido." }, 405);
  }

  const user = await authenticateRequest(req);
  if (user instanceof Response) return user;

  let payload: { invoice_id?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, reason: "Cuerpo de la petición inválido." }, 400);
  }

  const invoiceId = payload?.invoice_id;
  if (typeof invoiceId !== "string" || !UUID_PATTERN.test(invoiceId)) {
    return json({ ok: false, reason: "invoice_id debe ser un UUID válido." }, 400);
  }

  const context = await loadInvoiceContext(user, invoiceId);
  if (context instanceof Response) return context;

  const cfdiPayload = buildCfdiPayload(context);
  if (cfdiPayload instanceof Response) return cfdiPayload;

  if (context.invoice.status !== "draft") {
    return json(
      { ok: false, stamped: false, reason: "La factura ya no está disponible para timbrado." },
      409,
    );
  }

  const credentials = getSupabaseCredentials();
  if (credentials instanceof Response) return credentials;
  const supabase = createUserScopedClient(credentials, user.accessToken);
  const { data: claimed, error: claimError } = await supabase.rpc("claim_cfdi_stamp", {
    p_invoice_id: invoiceId,
  });
  if (claimError) {
    console.error("Unable to claim CFDI stamp", { invoiceId, error: claimError.message });
    return json({ ok: false, stamped: false, reason: "No fue posible iniciar el timbrado." }, 500);
  }
  if (!claimed) {
    return json(
      {
        ok: false,
        stamped: false,
        reason:
          "La factura ya está siendo timbrada o requiere conciliación. No la intentes emitir de nuevo.",
      },
      409,
    );
  }

  // Se declara fuera del try para que, sin importar en qué paso falle el
  // resto del flujo, el manejo de errores conozca si Facturama ya generó un
  // CFDI para esta factura y pueda guardarlo para su reconciliación.
  let cfdiId: string | null = null;

  try {
    // Send the validated object as-is; buildCfdiPayload remains the only mapper.
    const stampResponse = await createCfdi(cfdiPayload);
    cfdiId = getCfdiId(stampResponse);
    if (!cfdiId) {
      throw new CfdiWorkflowError(
        "Facturama timbró la solicitud pero no devolvió el identificador del CFDI.",
        502,
        stampResponse,
      );
    }

    const detailResponse = getCfdiUuid(stampResponse) ? stampResponse : await getCfdi(cfdiId);
    const uuid = getCfdiUuid(detailResponse);
    if (!uuid) {
      throw new CfdiWorkflowError(
        "Facturama no devolvió el UUID fiscal del CFDI timbrado.",
        502,
        detailResponse,
      );
    }

    const [xmlResponse, pdfResponse] = await Promise.all([
      downloadCfdi(cfdiId, "xml"),
      downloadCfdi(cfdiId, "pdf"),
    ]);
    const [xmlPath, pdfPath] = await Promise.all([
      storeCfdiDocument(user, invoiceId, "xml", documentBase64(xmlResponse)),
      storeCfdiDocument(user, invoiceId, "pdf", documentBase64(pdfResponse)),
    ]);
    if (xmlPath instanceof Response) {
      await markStampForReconciliation(
        user,
        invoiceId,
        new Error("No fue posible guardar el XML del CFDI."),
        cfdiId,
      );
      return xmlPath;
    }
    if (pdfPath instanceof Response) {
      await markStampForReconciliation(
        user,
        invoiceId,
        new Error("No fue posible guardar el PDF del CFDI."),
        cfdiId,
      );
      return pdfPath;
    }
    const pacResponse = {
      create: stampResponse,
      detail: detailResponse === stampResponse ? undefined : detailResponse,
      facturama_cfdi_id: cfdiId,
    };
    const { data: walletResult, error: finalizeError } = await supabase.rpc("finalize_cfdi_stamp", {
      p_invoice_id: invoiceId,
      p_uuid_fiscal: uuid,
      p_xml_url: xmlPath,
      p_pdf_url: pdfPath,
      p_pac_response: pacResponse,
    });
    if (finalizeError) {
      await removeStoredCfdiDocuments(user, invoiceId);
      throw new CfdiWorkflowError(
        `El CFDI fue timbrado, pero no se pudo finalizar su registro: ${finalizeError.message}`,
        409,
        pacResponse,
      );
    }

    return json({
      ok: true,
      stamped: true,
      stamp_consumed: true,
      invoice_id: invoiceId,
      uuid,
      xml_url: xmlPath,
      pdf_url: pdfPath,
      remaining_stamps: walletResult?.[0]?.balance ?? null,
    });
  } catch (error) {
    if (isFacturamaError(error) && error.status >= 400 && error.status < 500 && !cfdiId) {
      // Facturama rechazó la solicitud desde el inicio (4xx): nunca se generó
      // un CFDI, así que es seguro liberar el timbre reservado para reintentar.
      await releaseStampClaim(user, invoiceId, error);
    } else {
      // Cualquier otro caso es ambiguo (falla de red, 5xx, o un 4xx en un
      // paso posterior a que Facturama ya generara el CFDI): no se libera el
      // timbre ni se reintenta el timbrado automáticamente para evitar
      // duplicar el CFDI ante el SAT. Queda para reconciliación manual/auto.
      await markStampForReconciliation(user, invoiceId, error, cfdiId);
    }
    return integrationErrorResponse(error);
  }
});
