import "./lib/error-capture";

import * as Sentry from "@sentry/cloudflare";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";


type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const swallowed = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(swallowed);
  Sentry.captureException(swallowed);
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

const handlerObject = {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      Sentry.captureException(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

// Sentry (server/worker runtime): error monitoring + tracing.
// The DSN comes from the SENTRY_DSN environment variable — never hardcode it.
// Session Replay and Logging are intentionally NOT enabled.
export default Sentry.withSentry(
  (env: Record<string, string | undefined> | undefined) => ({
    dsn: env?.["SENTRY_DSN"] ?? process.env["SENTRY_DSN"] ?? "",
    environment: process.env["NODE_ENV"] ?? "development",
    // 1.0 captures every transaction — fine for development.
    // TODO: lower to ~0.1–0.2 in production to control quota/volume.
    tracesSampleRate: 1.0,
    sendDefaultPii: false,
  }),
  handlerObject as never,
) as typeof handlerObject;

