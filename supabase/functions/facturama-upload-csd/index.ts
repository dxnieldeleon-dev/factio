// Edge Function: facturama-upload-csd
// Carga un CSD en Facturama Multiemisor.
// Diseñada inicialmente para pruebas controladas en Sandbox.
//
// IMPORTANTE:
// - Nunca registra la contraseña en logs.
// - Nunca devuelve la llave privada.
// - Nunca devuelve las credenciales de Facturama.

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return json(
      {
        ok: false,
        reason: "Método no permitido.",
      },
      405,
    );
  }

  // Requiere un usuario autenticado en Supabase.
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

  // Leer configuración de Facturama desde Secrets.
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

  // Recibir CSD.
  let payload: {
    rfc?: string;
    certificate_base64?: string;
    private_key_base64?: string;
    private_key_password?: string;
  };

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

  const {
    rfc,
    certificate_base64,
    private_key_base64,
    private_key_password,
  } = payload ?? {};

  if (!rfc) {
    return json(
      {
        ok: false,
        field: "rfc",
        reason: "Falta el RFC del emisor.",
      },
      400,
    );
  }

  if (!certificate_base64) {
    return json(
      {
        ok: false,
        field: "certificate_base64",
        reason: "Falta el certificado CSD.",
      },
      400,
    );
  }

  if (!private_key_base64) {
    return json(
      {
        ok: false,
        field: "private_key_base64",
        reason: "Falta la llave privada del CSD.",
      },
      400,
    );
  }

  if (!private_key_password) {
    return json(
      {
        ok: false,
        field: "private_key_password",
        reason: "Falta la contraseña de la llave privada.",
      },
      400,
    );
  }

  const baseUrl =
    environment === "production"
      ? "https://api.facturama.mx"
      : "https://apisandbox.facturama.mx";

  const credentials = encodeBase64(
    new TextEncoder().encode(`${username}:${password}`),
  );

  /*
   * Payload esperado por la API Multiemisor.
   *
   * Mantener los nombres del modelo de Facturama separados
   * del modelo interno de Factio.
   */
  const facturamaPayload = {
    Rfc: rfc.trim().toUpperCase(),
    Certificate: certificate_base64,
    PrivateKey: private_key_base64,
    PrivateKeyPassword: private_key_password,
  };

  try {
    const response = await fetch(
      `${baseUrl}/api-lite/csds`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify(facturamaPayload),
      },
    );

    let responseBody: unknown = null;

    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }

    if (!response.ok) {
      // No registrar payload, certificados ni contraseña.
      console.error("Facturama CSD upload error", {
        status: response.status,
        statusText: response.statusText,
        environment,
        rfc: rfc.trim().toUpperCase(),
      });

      return json(
        {
          ok: false,
          uploaded: false,
          environment,
          facturama_status: response.status,
          facturama_response: responseBody,
          reason:
            "Facturama rechazó la carga del CSD.",
        },
        400,
      );
    }

    return json({
      ok: true,
      uploaded: true,
      environment,
      rfc: rfc.trim().toUpperCase(),
      message:
        "CSD cargado correctamente en Facturama Multiemisor.",
    });
  } catch (error) {
    console.error(
      "Facturama CSD connection error:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return json(
      {
        ok: false,
        uploaded: false,
        reason:
          "No fue posible comunicarse con Facturama.",
      },
      502,
    );
  }
});
