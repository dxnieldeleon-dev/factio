import { CheckCircle2 } from "lucide-react";
import { formatDateMX } from "@/lib/format";
import type { CsdSuccessResult } from "./useCsdUpload";
import type { CompanyProfile } from "../company-profile";

export function CsdSuccessScreen({
  result,
  company,
  onContinue,
}: {
  result: CsdSuccessResult;
  company: CompanyProfile | null;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5 py-4 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
        <CheckCircle2 className="size-8" />
      </div>
      <div>
        <h2 className="text-lg font-bold tracking-tight">
          Tu Certificado de Sello Digital fue configurado correctamente.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Ya puedes empezar a facturar.</p>
      </div>

      <dl className="space-y-2 rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm">
        <SummaryRow label="RFC" value={result.rfc} mono />
        {company?.legal_name && <SummaryRow label="Razón social" value={company.legal_name} />}
        <SummaryRow label="Número de certificado" value={result.serial_number} mono />
        <SummaryRow label="Emitido" value={formatDateMX(result.valid_from)} />
        <SummaryRow label="Vigente hasta" value={formatDateMX(result.valid_to)} />
      </dl>

      <button
        type="button"
        onClick={onContinue}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-semibold text-background transition active:scale-[0.98]"
      >
        Continuar
      </button>
    </div>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`truncate font-semibold ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
