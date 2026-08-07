import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Cierra sesión garantizando que la sesión local siempre se limpie, incluso
// con mala conexión (el caso típico en móvil): scope 'local' evita depender
// de la llamada de red a /auth/v1/logout — si esa llamada falla, el scope
// 'global' por default puede dejar la sesión vieja en localStorage, y la
// siguiente visita a /auth reingresa sola con la sesión cacheada en vez de
// mostrar el formulario. También limpia la caché de React Query para que no
// queden datos de la cuenta anterior visibles si alguien más inicia sesión
// en el mismo dispositivo.
export async function signOutFactio(queryClient: QueryClient): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // La sesión local ya se limpia de todos modos con scope 'local' — un
    // error aquí no debe bloquear la navegación de vuelta a /auth.
  }
  queryClient.clear();
}
