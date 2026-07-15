// Edge Function: facturama-test
// Verifica la configuración del servidor y realiza una petición
// autenticada contra Facturama.
// NUNCA devuelve las credenciales ni el encabezado Authorization.

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

  // Requiere un usuario autenticado.
  // El gateway de Supabase debe validar el JWT cuando verify_jwt está habilitado.
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

  // Leer secretos exclusivamente en el servidor.
  const username = Deno.env.get("FACTURAMA_USERNAME");
  const password = Deno.env.get("FACTURAMA_PASSWORD");
  const environment =
    Deno.env.get("FACTURAMA_ENV") ?? "sandbox";

  if (!username || !password) {
    return json(
      {
        ok: false,
        configured: false,
        environment,
        reason:
          "Las credenciales de Facturama no están configuradas en el servidor.",
      },
      500,
    );
  }

  const baseUrl =
    environment === "production"
      ? "https://api.facturama.mx"
      : "https://apisandbox.facturama.mx";

  const credentials = encodeBase64(
    new TextEncoder().encode(`${username}:${password}`),
  );

  try {
    /*
     * Prueba de autenticación.
     *
     * Esta petición consulta un recurso autenticado de Facturama.
     * No crea ni timbra un CFDI.
     */
    const response = await fetch(
      `${baseUrl}/api/Client`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${credentials}`,
        },
      },
    );

    let responseBody: unknown = null;

    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }

    if (!response.ok) {
  console.error("Facturama API error", {
    status: response.status,
    statusText: response.statusText,
    environment,
    response: responseBody,
  });

  return json(
    {
      ok: false,
      configured: true,
      authenticated: response.status !== 401,
      environment,
      facturama_status: response.status,
      facturama_status_text: response.statusText,
      facturama_response: responseBody,
      reason:
        response.status === 401
          ? "Facturama rechazó las credenciales."
          : "Facturama respondió con un error.",
    },
    response.status >= 500 ? 502 : 400,
  );
}

    return json({
      ok: true,
      configured: true,
      authenticated: true,
      environment,
      status: response.status,
      message:
        "Conexión autenticada con Facturama realizada correctamente.",
      response_received: responseBody !== null,
    });
  } catch (error) {
    console.error(
      "Facturama connection error:",
      error instanceof Error
        ? error.message
        : "Unknown error",
    );

    return json(
      {
        ok: false,
        configured: true,
        authenticated: false,
        environment,
        reason:
          "No fue posible establecer comunicación con Facturama.",
      },
      502,
    );
  }
});
