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

export function pacMessage(response: unknown, fallback: string): string {
  if (!response || typeof response !== "object") return fallback;
  const body = response as Record<string, unknown>;
  for (const key of ["Message", "message", "error_description", "detail", "title"]) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}
