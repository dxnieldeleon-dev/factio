import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getFacturamaConfig } from "./client.server";

export const getFacturamaConfigurationStatus = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const config = getFacturamaConfig();

      return {
        ok: true,
        configured: true,
        environment: config.environment,
        baseUrl: config.baseUrl,
        message: "Facturama está configurado en el servidor.",
      };
    } catch (error) {
      return {
        ok: false,
        configured: false,
        message:
          error instanceof Error
            ? error.message
            : "Error desconocido al configurar Facturama.",
      };
    }
  });
