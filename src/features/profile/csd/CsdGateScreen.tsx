import { FileCheck2, ShieldCheck, Sparkles } from "lucide-react";

export function CsdGateScreen({
  onHaveCsd,
  onGenerateCsd,
}: {
  onHaveCsd: () => void;
  onGenerateCsd: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
        <ShieldCheck className="size-6" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold tracking-tight">
          Configura tu Certificado de Sello Digital
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          El CSD es lo que necesitas para poder timbrar tus facturas ante el SAT. Si ya lo tienes,
          lo puedes subir en segundos. Si no, Factio puede generarlo por ti usando tu e.firma.
        </p>
      </div>

      <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        ¿Ya cuentas con un Certificado de Sello Digital (CSD)?
      </p>

      <div className="space-y-2.5">
        <button
          type="button"
          onClick={onHaveCsd}
          className="flex w-full items-center gap-3 rounded-2xl bg-foreground px-5 py-4 text-left text-sm font-semibold text-background transition active:scale-[0.98]"
        >
          <FileCheck2 className="size-5 shrink-0" />
          <span className="flex-1">Sí, ya tengo mi CSD</span>
        </button>
        <button
          type="button"
          onClick={onGenerateCsd}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 text-left text-sm font-semibold transition active:scale-[0.98]"
        >
          <Sparkles className="size-5 shrink-0 text-primary" />
          <span className="flex-1">No, quiero que Factio lo genere</span>
        </button>
      </div>
    </div>
  );
}
