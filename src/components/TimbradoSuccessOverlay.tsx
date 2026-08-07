import { useEffect } from "react";

// Overlay transitorio que confirma visualmente que el CFDI se timbró: un
// sello circular (paleta azul de marca, no verde) con un check que se
// "dibuja" vía stroke-dashoffset, más dos líneas de texto con fade-in. Sin
// confeti ni partículas — se cierra solo a los ~2.5s o al hacer clic afuera.

const AUTO_CLOSE_MS = 2500;

interface TimbradoSuccessOverlayProps {
  open: boolean;
  onClose: () => void;
  /** UUID/folio fiscal ya confirmado por el PAC, si está disponible. */
  folioFiscal?: string | null;
}

export function TimbradoSuccessOverlay({
  open,
  onClose,
  folioFiscal,
}: TimbradoSuccessOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Factura timbrada"
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40"
      style={{ animation: "tso-backdrop-in 200ms ease-out" }}
    >
      <div
        className="flex flex-col items-center px-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="grid place-items-center rounded-full bg-primary-soft"
          style={{
            width: 88,
            height: 88,
            animation: "tso-circle-in 550ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
          }}
        >
          <svg width={40} height={40} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 13l4 4L19 7"
              stroke="var(--primary)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={30}
              strokeDasharray={30}
              strokeDashoffset={30}
              style={{
                animation: "tso-check-draw 350ms ease-out 150ms both",
              }}
            />
          </svg>
        </div>

        <p
          className="mt-4 text-base text-foreground"
          style={{ fontWeight: 500, animation: "tso-fade-in 300ms ease-out 350ms both" }}
        >
          Factura timbrada
        </p>
        <p
          className="mt-1 max-w-[260px] break-all text-xs text-muted-foreground"
          style={{ animation: "tso-fade-in 300ms ease-out 450ms both" }}
        >
          {folioFiscal ? `Folio fiscal: ${folioFiscal}` : "Folio fiscal generado correctamente"}
        </p>
      </div>

      <style>{`
        @keyframes tso-backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tso-circle-in {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes tso-check-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes tso-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
