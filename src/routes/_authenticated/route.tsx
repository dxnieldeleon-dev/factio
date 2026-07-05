import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Onboarding gate: only force wizard if Section A (fiscal profile) is incomplete.
    // Once RFC/legal_name/tax_regime/postal_code exist, let the user navigate the app
    // even if onboarding_completed is still false (Step 2 CSD pending).
    if (!location.pathname.startsWith("/onboarding")) {
      const { data: comp } = await supabase
        .from("companies")
        .select("id, rfc, legal_name, tax_regime, postal_code")
        .eq("user_id", data.user.id)
        .maybeSingle();
      const sectionAComplete = !!(comp?.rfc && comp?.legal_name && comp?.tax_regime && comp?.postal_code);
      if (!sectionAComplete) {
        throw redirect({ to: "/onboarding" });
      }
    }

    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
