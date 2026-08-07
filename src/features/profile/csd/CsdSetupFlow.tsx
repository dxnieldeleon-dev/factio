import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { isCsdConfigured, type CompanyProfileData } from "../company-profile";
import { useCsdUpload } from "./useCsdUpload";
import { CsdGateScreen } from "./CsdGateScreen";
import { CsdUploadScreen } from "./CsdUploadScreen";
import { CsdValidatingChecklist } from "./CsdValidatingChecklist";
import { CsdSuccessScreen } from "./CsdSuccessScreen";
import { CsdComingSoonScreen } from "./CsdComingSoonScreen";

type Screen = "gate" | "upload" | "validating" | "success" | "coming_soon";

export function CsdSetupFlow({
  profile,
  onComplete,
  allowSkip = false,
  onSkip,
}: {
  profile: CompanyProfileData;
  onComplete: () => void;
  allowSkip?: boolean;
  onSkip?: () => void;
}) {
  const configured = isCsdConfigured(profile.company);
  // Si ya tiene un CSD configurado, esto es un reemplazo/renovación — va
  // directo al formulario en vez de repetir la pregunta inicial.
  const [screen, setScreen] = useState<Screen>(configured ? "upload" : "gate");
  const csd = useCsdUpload(profile);

  return (
    <div className="space-y-4">
      {configured && screen === "upload" && <ConfiguredBadge />}

      {screen === "gate" && (
        <CsdGateScreen
          onHaveCsd={() => setScreen("upload")}
          onGenerateCsd={() => setScreen("coming_soon")}
        />
      )}

      {screen === "coming_soon" && <CsdComingSoonScreen onBack={() => setScreen("upload")} />}

      {screen === "upload" && (
        <CsdUploadScreen csd={csd} onValidated={() => setScreen("validating")} />
      )}

      {screen === "validating" && <CsdValidatingChecklist onDone={() => setScreen("success")} />}

      {screen === "success" && csd.result && (
        <CsdSuccessScreen result={csd.result} company={profile.company} onContinue={onComplete} />
      )}

      {allowSkip && (screen === "gate" || screen === "upload") && (
        <button
          type="button"
          onClick={onSkip}
          className="mx-auto flex items-center justify-center gap-2 rounded-full border border-input bg-background px-5 py-2.5 text-xs font-semibold text-foreground transition hover:bg-accent"
        >
          <ArrowRight className="size-4" /> Omitir por ahora
        </button>
      )}
    </div>
  );
}

function ConfiguredBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
      <CheckCircle2 className="size-3.5" />
      CSD configurado — sube archivos nuevos para reemplazarlo
    </div>
  );
}
