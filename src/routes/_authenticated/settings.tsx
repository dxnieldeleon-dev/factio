import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bell, Moon, Fingerprint, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

interface Prefs {
  notifications_enabled: boolean;
  biometrics_enabled: boolean;
  pin_enabled: boolean;
  theme: string;
}

function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("settings").select("*").eq("user_id", u.user!.id).maybeSingle();
      setPrefs({
        notifications_enabled: data?.notifications_enabled ?? true,
        biometrics_enabled: data?.biometrics_enabled ?? false,
        pin_enabled: data?.pin_enabled ?? false,
        theme: data?.theme ?? "light",
      });
    })();
  }, []);

  async function toggle(k: keyof Prefs) {
    if (!prefs) return;
    const next = { ...prefs, [k]: typeof prefs[k] === "boolean" ? !prefs[k] : prefs[k] };
    setPrefs(next);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("settings").upsert({ user_id: u.user!.id, ...next });
    if (error) toast.error("No pudimos guardar"); else toast.success("Preferencias actualizadas");
  }

  async function setTheme(theme: "light" | "dark") {
    if (!prefs) return;
    setPrefs({ ...prefs, theme });
    document.documentElement.classList.toggle("dark", theme === "dark");
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("settings").upsert({ user_id: u.user!.id, ...prefs, theme });
  }

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
      <header className="flex items-center gap-3">
        <Link to="/profile" className="grid size-10 place-items-center rounded-full border border-border bg-surface">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Configuración</h1>
      </header>

      <section className="mt-6 space-y-2">
        <Row
          icon={Bell}
          title="Notificaciones"
          subtitle="Recibir alertas de timbrado y vencimientos"
          checked={prefs?.notifications_enabled ?? true}
          onToggle={() => toggle("notifications_enabled")}
        />
        <Row
          icon={Moon}
          title="Tema oscuro"
          subtitle="Cambia el aspecto de la app"
          checked={prefs?.theme === "dark"}
          onToggle={() => setTheme(prefs?.theme === "dark" ? "light" : "dark")}
        />
        <Row
          icon={Fingerprint}
          title="Biometría"
          subtitle="Usar huella o Face ID al abrir"
          checked={prefs?.biometrics_enabled ?? false}
          onToggle={() => toggle("biometrics_enabled")}
        />
        <Row
          icon={KeyRound}
          title="PIN de seguridad"
          subtitle="Protege la app con un PIN de 4 dígitos"
          checked={prefs?.pin_enabled ?? false}
          onToggle={() => toggle("pin_enabled")}
        />
      </section>
    </div>
  );
}

function Row({ icon: Icon, title, subtitle, checked, onToggle }: { icon: typeof Bell; title: string; subtitle: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left transition active:scale-[0.99]"
    >
      <div className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-4" />
      </div>
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <span className={`relative inline-block h-6 w-10 rounded-full transition ${checked ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
