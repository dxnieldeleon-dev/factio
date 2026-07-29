/**
 * Extracts the safe, user-facing error returned by an Edge Function.
 * Supabase wraps non-2xx responses in a generic FunctionsHttpError, while the
 * function's JSON body contains the meaningful `reason` or `error` value.
 */
export async function getEdgeFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await (typeof context.clone === "function" ? context.clone() : context).json();
      if (typeof body?.reason === "string" && body.reason) return body.reason;
      if (typeof body?.error === "string" && body.error) return body.error;
      if (typeof body?.message === "string" && body.message) return body.message;
    } catch {
      // The response is not JSON or its body has already been consumed.
    }
  }

  return error instanceof Error && error.message ? error.message : fallback;
}
