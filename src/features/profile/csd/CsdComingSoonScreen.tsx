import { ArrowLeft, Clock } from "lucide-react";

export function CsdComingSoonScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-5 py-4 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
        <Clock className="size-6" />
      </div>
      <div>
        <h2 className="text-lg font-bold tracking-tight">Estamos preparando esto</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Generar tu Certificado de Sello Digital automáticamente todavía no está disponible. Por
          ahora, la forma más rápida de empezar a facturar es subir un CSD que ya tengas.
        </p>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="mx-auto flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold transition active:scale-[0.98]"
      >
        <ArrowLeft className="size-4" />
        Ya tengo mi CSD
      </button>
    </div>
  );
}
