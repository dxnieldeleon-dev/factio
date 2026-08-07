// Campanita de éxito para el timbrado: 3 notas ascendentes tipo carillón,
// generadas con Web Audio API — sin archivo .mp3 externo que empaquetar.

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) sharedContext = new Ctor();
  return sharedContext;
}

const CHIME_FREQUENCIES_HZ = [660, 880, 1320];
const NOTE_OFFSET_S = 0.08;
const NOTE_DURATION_S = 0.35;
const PEAK_GAIN = 0.15;

export function playSuccessChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // El timbrado ya es una acción iniciada por el usuario (click en
    // "Emitir factura" / "Continuar con el timbrado"), así que resume()
    // no debería quedar bloqueado por la política de autoplay del
    // navegador — pero se cubre por si el contexto arrancó "suspended".
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {
        // Sin sonido esta vez; el overlay visual sigue funcionando igual.
      });
    }

    const now = ctx.currentTime;
    for (const [i, freq] of CHIME_FREQUENCIES_HZ.entries()) {
      const startAt = now + i * NOTE_OFFSET_S;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, startAt);

      // Ataque rápido y decaimiento exponencial — el ramp exponencial no
      // puede llegar exactamente a 0, así que se usa un valor mínimo audible.
      gainNode.gain.setValueAtTime(0, startAt);
      gainNode.gain.linearRampToValueAtTime(PEAK_GAIN, startAt + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + NOTE_DURATION_S);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + NOTE_DURATION_S + 0.05);
    }
  } catch {
    // Cualquier falla de audio (contexto no soportado, política del
    // navegador, etc.) nunca debe romper el flujo de timbrado.
  }
}
