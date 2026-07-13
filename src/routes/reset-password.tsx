import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Nueva contraseña — Factio" }],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña actualizada");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "No pudimos actualizar tu contraseña. El enlace pudo haber expirado, solicita uno nuevo.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell flex min-h-dvh flex-col justify-center px-6 py-10">
      <div className="animate-reveal">
        <h1 className="text-2xl font-bold tracking-tight">Crea tu nueva contraseña</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Elige una contraseña nueva para tu cuenta de Factio.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nueva contraseña (mín. 8 caracteres)"
            className="w-full rounded-2xl border border-input bg-surface py-3.5 pl-11 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring"
          />
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirma tu contraseña"
            className="w-full rounded-2xl border border-input bg-surface py-3.5 pl-11 pr-4 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-semibold text-background transition active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <>Guardar contraseña <ArrowRight className="size-4" /></>}
        </button>
      </form>
    </div>
  );
}
