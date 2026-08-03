import type { Router } from "@tanstack/react-router";

/**
 * Browser-side Sentry initialization (Error Monitoring + Tracing).
 *
 * The DSN is read from the VITE_SENTRY_DSN environment variable — never hardcode it.
 * If the variable is absent, Sentry stays disabled and the app behaves normally.
 *
 * Session Replay and Logging are intentionally NOT enabled.
 */
let initialized = false;

export async function initSentryClient(router: Router<never, never, never>) {
  if (initialized) return;
  if (typeof document === "undefined") return;

  const dsn = import.meta.env["VITE_SENTRY_DSN"] as string | undefined;
  if (!dsn) return;

  initialized = true;

  const Sentry = await import("@sentry/tanstackstart-react");

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [
      // Tracing/Performance, wired to TanStack Router navigations.
      Sentry.tanstackRouterBrowserTracingIntegration(router),
    ],
    // 1.0 captures every transaction — fine for development.
    // TODO: lower to ~0.1–0.2 in production to control quota/volume.
    tracesSampleRate: import.meta.env.PROD ? 1.0 : 1.0,
    sendDefaultPii: false,
  });
}

/** Reports an unhandled route/render error to Sentry (no-op when disabled). */
export function captureRouteException(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof document === "undefined" || !initialized) return;
  void import("@sentry/tanstackstart-react").then((Sentry) => {
    Sentry.captureException(error, { extra: context });
  });
}
