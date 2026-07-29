import { encodeBase64 } from "jsr:@std/encoding/base64";
import { FacturamaError, pacMessage } from "./errors.ts";
import type {
  FacturamaCfdiResponse,
  FacturamaCsdPayload,
  FacturamaCancellationResponse,
  FacturamaConfig,
  FacturamaDocumentFormat,
  FacturamaDocumentResponse,
  FacturamaEnvironment,
} from "./types.ts";

const BASE_URLS: Record<FacturamaEnvironment, string> = {
  sandbox: "https://apisandbox.facturama.mx",
  production: "https://api.facturama.mx",
};

function config(): FacturamaConfig {
  const username = Deno.env.get("FACTURAMA_USERNAME");
  const password = Deno.env.get("FACTURAMA_PASSWORD");
  const configuredEnvironment = Deno.env.get("FACTURAMA_ENV") ?? "sandbox";

  if (!username || !password) {
    throw new FacturamaError(
      "Las credenciales de Facturama no están configuradas en el servidor.",
      500,
    );
  }
  if (configuredEnvironment !== "sandbox" && configuredEnvironment !== "production") {
    throw new FacturamaError("FACTURAMA_ENV debe ser sandbox o production.", 500);
  }

  return {
    username,
    password,
    environment: configuredEnvironment,
    baseUrl: BASE_URLS[configuredEnvironment],
  };
}

function basicAuth(username: string, password: string) {
  return `Basic ${encodeBase64(new TextEncoder().encode(`${username}:${password}`))}`;
}

async function readBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  const text = await response.text();
  return text || null;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const { username, password, baseUrl } = config();
  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: basicAuth(username, password),
        ...init.headers,
      },
    });
  } catch (cause) {
    throw new FacturamaError(
      "No fue posible establecer comunicación con Facturama.",
      502,
      null,
      cause,
    );
  }

  const body = await readBody(response);
  if (!response.ok) {
    throw new FacturamaError(
      pacMessage(body, `Facturama respondió con HTTP ${response.status}.`),
      response.status,
      body,
    );
  }
  return body as T;
}

export async function createCfdi(payload: object) {
  return await request<FacturamaCfdiResponse>("/api-lite/3/cfdis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function uploadCsd(payload: FacturamaCsdPayload) {
  return await request<unknown>("/api-lite/csds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function cancelCfdi(
  id: string,
  motive: "01" | "02" | "03" | "04",
  uuidReplacement?: string,
) {
  const query = new URLSearchParams({ motive });
  if (uuidReplacement) query.set("uuidReplacement", uuidReplacement);
  return await request<FacturamaCancellationResponse>(
    `/api-lite/cfdis/${encodeURIComponent(id)}?${query.toString()}`,
    { method: "DELETE" },
  );
}

export async function downloadCfdi(id: string, format: FacturamaDocumentFormat) {
  return await request<FacturamaDocumentResponse>(
    `/cfdi/${format}/issuedLite/${encodeURIComponent(id)}`,
    { method: "GET" },
  );
}

export async function getCfdi(id: string) {
  return await request<FacturamaCfdiResponse>(`/api-lite/cfdis/${encodeURIComponent(id)}`, {
    method: "GET",
  });
}

export function getCfdiId(response: FacturamaCfdiResponse): string | null {
  for (const key of ["Id", "id"]) {
    const value = response[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

export function getCfdiUuid(response: FacturamaCfdiResponse): string | null {
  for (const key of ["Uuid", "UUID", "uuid"]) {
    const value = response[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

export function documentBase64(response: FacturamaDocumentResponse): string {
  const content = response.Content ?? response.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new FacturamaError(
      "Facturama no devolvió el contenido del documento solicitado.",
      502,
      response,
    );
  }
  return content.replace(/^data:[^,]+,/, "");
}
