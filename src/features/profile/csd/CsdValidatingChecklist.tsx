import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

const CHECKS = ["Certificado válido", "Llave privada válida", "Contraseña correcta"];
const STEP_DELAY_MS = 300;
const HOLD_AFTER_LAST_MS = 500;

// La validación real ya ocurrió en una sola llamada al servidor (ver
// useCsdUpload.save()) — esto solo revela la confirmación en secuencia para
// que se sienta como un checklist, no una barra de progreso genérica.
export function CsdValidatingChecklist({ onDone }: { onDone: () => void }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (visibleCount >= CHECKS.length) {
      const timer = setTimeout(onDone, HOLD_AFTER_LAST_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setVisibleCount((n) => n + 1), STEP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visibleCount, onDone]);

  return (
    <div className="space-y-3 py-6">
      <h2 className="text-center text-lg font-bold tracking-tight">Validando tu certificado…</h2>
      <ul className="mx-auto mt-4 max-w-xs space-y-3">
        {CHECKS.map((label, i) => {
          const shown = i < visibleCount;
          return (
            <li
              key={label}
              className="flex items-center gap-3 text-sm font-medium transition-opacity"
              style={{ opacity: shown ? 1 : 0.35 }}
            >
              {shown ? (
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
              ) : (
                <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
              )}
              {label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
