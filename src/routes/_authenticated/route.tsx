import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Onboarding gate: if no company row or onboarding not completed, force wizard.
    if (!location.pathname.startsWith("/onboarding")) {
      const { data: comp } = await supabase
        .from("companies")
        .select("id, onboarding_completed")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (!comp || !comp.onboarding_completed) {
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
