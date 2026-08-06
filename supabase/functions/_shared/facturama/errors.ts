export class FacturamaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly pacResponse: unknown = null,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "FacturamaError";
  }
}

export function isFacturamaError(error: unknown): error is FacturamaError {
  return error instanceof FacturamaError;
}

export class CfdiWorkflowError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly pacResponse: unknown = null,
  ) {
    super(message);
    this.name = "CfdiWorkflowError";
  }
}

export function isCfdiWorkflowError(error: unknown): error is CfdiWorkflowError {
  return error instanceof CfdiWorkflowError;
}

// Facturama's api-lite wraps ASP.NET model-validation failures behind a generic
// top-level "Message" (e.g. "La solicitud no es válida.") while the actual
// per-field reason lives in "ModelState" (classic ASP.NET Web API) or "errors"
// (ASP.NET Core ProblemDetails) — both keyed by field path to an array of
// messages. Surface those too, or the real cause never reaches the user/logs.
function fieldErrors(body: Record<string, unknown>): string | null {
  for (const key of ["ModelState", "modelState", "errors"]) {
    const value = body[key];
    if (!value || typeof value !== "object") continue;
    const parts = Object.entries(value as Record<string, unknown>)
      .map(([field, messages]) => {
        const text = Array.isArray(messages) ? messages.join(" ") : String(messages);
        return text.trim() ? `${field}: ${text}` : null;
      })
      .filter((entry): entry is string => entry !== null);
    if (parts.length) return parts.join(" | ");
  }
  return null;
}

export function pacMessage(response: unknown, fallback: string): string {
  if (!response || typeof response !== "object") return fallback;
  const body = response as Record<string, unknown>;
  let message = fallback;
  for (const key of ["Message", "message", "error_description", "detail", "title"]) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) {
      message = value;
      break;
    }
  }
  const details = fieldErrors(body);
  return details ? `${message} (${details})` : message;
}

const FACTURAMA_MENTION = /\bfacturama\b/gi;

// Facturama's own error copy sometimes names them directly (e.g. "El equipo
// de Facturama ya se encuentra informado de este error"), which reads oddly
// surfaced as our own product's error and needlessly exposes which PAC we
// use under the hood. A 5xx from them is their own infra failing (often
// their sandbox, which is flakier than production) and isn't something the
// user can act on, so it gets replaced entirely with our own retry message.
// A 4xx is usually specific and actionable (bad input, duplicate CSD, etc.)
// and safe to forward, but still gets their name scrubbed as a fallback.
export function userFacingPacMessage(error: FacturamaError, retryFallback: string): string {
  if (error.status >= 500) return retryFallback;
  return error.message.replace(FACTURAMA_MENTION, "el proveedor de timbrado");
}
