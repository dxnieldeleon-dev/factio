import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CsdSetupFlow } from "@/features/profile/csd/CsdSetupFlow";
import { loadCompanyProfile } from "@/features/profile/company-profile";

export const Route = createFileRoute("/_authenticated/profile/csd")({ component: CsdProfilePage });

function CsdProfilePage() {
  const navigate = useNavigate();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["company-profile"],
    queryFn: loadCompanyProfile,
  });
  if (isLoading || !profile)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
      <header className="flex items-center gap-3">
        <Link
          to="/profile"
          className="grid size-10 place-items-center rounded-full border border-border bg-surface"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Perfil
          </p>
          <h1 className="text-xl font-bold tracking-tight">Certificado de sello digital</h1>
        </div>
      </header>
      <div className="mt-6">
        <CsdSetupFlow profile={profile} onComplete={() => navigate({ to: "/profile" })} />
      </div>
    </div>
  );
}
