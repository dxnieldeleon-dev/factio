import { Clock, FileCheck2, ShieldCheck, Sparkles } from "lucide-react";

export function CsdGateScreen({ onHaveCsd }: { onHaveCsd: () => void }) {
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
          lo puedes subir en segundos.
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
        <div
          aria-disabled="true"
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 text-left text-sm font-semibold opacity-50"
        >
          <Sparkles className="size-5 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-muted-foreground">No, quiero que Factio lo genere</span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="size-3" />
            Próximamente
          </span>
        </div>
      </div>
    </div>
  );
}
