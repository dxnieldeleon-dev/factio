// Edge Function: facturama-create-cfdi
// Crea un CFDI mediante Facturama API Multiemisor.
//
// Primera versión para pruebas controladas en Sandbox.
// No conecta todavía el formulario real de Factio ni guarda el CFDI
// en la base de datos.

import { encodeBase64 } from "jsr:@std/encoding/base64";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "content-type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  // Responder solicitudes CORS preflight.
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: cors,
    });
  }

  // Solo permitir POST.
  if (req.method !== "POST") {
    return json(
      {
        ok: false,
        reason: "Método no permitido.",
      },
      405,
    );
  }

  // ---------------------------------------------------------
  // 1. Verificar autenticación de Supabase
  // ---------------------------------------------------------

  const authHeader =
    req.headers.get("authorization") ??
    req.headers.get("Authorization");

  if (
    !authHeader ||
    !authHeader.toLowerCase().startsWith("bearer ")
  ) {
    return json(
      {
        ok: false,
        reason: "No autenticado.",
      },
      401,
    );
  }

  const token = authHeader.slice(7).trim();

  if (!token || token.split(".").length !== 3) {
    return json(
      {
        ok: false,
        reason: "Token inválido.",
      },
      401,
    );
  }

  // ---------------------------------------------------------
  // 2. Obtener configuración de Facturama
  // ---------------------------------------------------------

  const username = Deno.env.get("FACTURAMA_USERNAME");
  const password = Deno.env.get("FACTURAMA_PASSWORD");
  const environment =
    Deno.env.get("FACTURAMA_ENV") ?? "sandbox";

  if (!username || !password) {
    return json(
      {
        ok: false,
        configured: false,
        reason:
          "Las credenciales de Facturama no están configuradas.",
      },
      500,
    );
  }

  // ---------------------------------------------------------
  // 3. Recibir payload del CFDI
  // ---------------------------------------------------------

  let payload: Record<string, unknown>;

  try {
    payload = await req.json();
  } catch {
    return json(
      {
        ok: false,
        reason: "Cuerpo de la petición inválido.",
      },
      400,
    );
  }

  // ---------------------------------------------------------
  // 4. Validaciones mínimas
  // ---------------------------------------------------------

  if (!payload.Issuer) {
    return json(
      {
        ok: false,
        field: "Issuer",
        reason: "Falta el emisor.",
      },
      400,
    );
  }

  if (!payload.Receiver) {
    return json(
      {
        ok: false,
        field: "Receiver",
        reason: "Falta el receptor.",
      },
      400,
    );
  }

  if (
    !Array.isArray(payload.Items) ||
    payload.Items.length === 0
  ) {
    return json(
      {
        ok: false,
        field: "Items",
        reason:
          "La factura debe contener al menos un concepto.",
      },
      400,
    );
  }

  // ---------------------------------------------------------
  // 5. Seleccionar URL de Facturama
  // ---------------------------------------------------------

  const baseUrl =
    environment === "production"
      ? "https://api.facturama.mx"
      : "https://apisandbox.facturama.mx";

  // ---------------------------------------------------------
  // 6. Crear Basic Authentication
  // ---------------------------------------------------------

  const credentials = encodeBase64(
    new TextEncoder().encode(
      `${username}:${password}`,
    ),
  );

  // ---------------------------------------------------------
  // 7. Enviar CFDI a Facturama
  // ---------------------------------------------------------

  try {
    const response = await fetch(
      `${baseUrl}/api-lite/3/cfdis`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify(payload),
      },
    );

    // -------------------------------------------------------
    // 8. Leer respuesta de Facturama
    // -------------------------------------------------------
    //
    // Primero se lee como texto.
    // Esto permite capturar errores aunque Facturama no
    // responda con JSON válido.

    const responseText = await response.text();

    let responseBody: unknown = null;

    if (responseText) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = responseText;
      }
    }

    // -------------------------------------------------------
    // 9. Manejar error de Facturama
    // -------------------------------------------------------

    if (!response.ok) {
      // IMPORTANTE:
      // No registrar credenciales, certificados,
      // contraseñas ni el payload completo.

      console.error(
        "Facturama CFDI error:",
        JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          environment,
          response: responseBody,
        }),
      );

      return json(
        {
          ok: false,
          stamped: false,
          environment,
          facturama_status: response.status,
          facturama_status_text:
            response.statusText,
          facturama_response: responseBody,
          reason:
            "Facturama rechazó la creación del CFDI.",
        },
        400,
      );
    }

    // -------------------------------------------------------
    // 10. CFDI creado correctamente
    // -------------------------------------------------------

    return json({
      ok: true,
      stamped: true,
      environment,
      message:
        "CFDI creado correctamente en Facturama Sandbox.",
      cfdi: responseBody,
    });
  } catch (error) {
    // -------------------------------------------------------
    // 11. Error de conexión
    // -------------------------------------------------------

    console.error(
      "Facturama CFDI connection error:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return json(
      {
        ok: false,
        stamped: false,
        reason:
          "No fue posible comunicarse con Facturama.",
      },
      502,
    );
  }
});
