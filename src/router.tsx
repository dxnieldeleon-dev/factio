import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import * as Sentry from "@sentry/tanstackstart-react";
import { routeTree } from "./routeTree.gen";

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (typeof document !== "undefined" && dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
  });
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  if (typeof document !== "undefined" && dsn) {
    Sentry.addIntegration(Sentry.tanstackRouterBrowserTracingIntegration(router));
  }

  return router;
};
