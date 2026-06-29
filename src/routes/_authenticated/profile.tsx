import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { LogOut, Building2, Settings, Loader2, ShieldCheck, Eye, EyeOff, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TAX_REGIMES } from "@/lib/sat-catalogs";
import { validateRFC } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
});

async function loadProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", userData.user!.id)
    .maybeSingle();
  return { user: userData.user, company };
}

function Profile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: loadProfile });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    legal_name: string; trade_name: string; rfc: string; tax_regime: string;
    postal_code: string; email: string; phone: string;
  } | null>(null);

  const cerInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const [cerFile, setCerFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [csdPassword, setCsdPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingCsd, setSavingCsd] = useState(false);

  const hasCsdConfigured = !!(data?.company?.csd_cer_url && data?.company?.csd_key_url);
  const canSaveCsd = !!cerFile || !!keyFile || csdPassword.length > 0;

  async function onSaveCsd() {
    if (!data?.user) return;
    if (!data.company) {
      toast.error("Primero guarda los datos fiscales del perfil");
      return;
    }
    setSavingCsd(true);
    try {
      const userId = data.user.id;
      const updates: { csd_cer_url?: string; csd_key_url?: string; csd_password_encrypted?: string } = {};
      if (cerFile) {
        const path = `${userId}/cert.cer`;
        const { error } = await supabase.storage.from("csd-files").upload(path, cerFile, { upsert: true });
        if (error) throw error;
        updates.csd_cer_url = path;
      }
      if (keyFile) {
        const path = `${userId}/private.key`;
        const { error } = await supabase.storage.from("csd-files").upload(path, keyFile, { upsert: true });
        if (error) throw error;
        updates.csd_key_url = path;
      }
      if (csdPassword.length > 0) {
        updates.csd_password_encrypted = csdPassword;
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("companies").update(updates).eq("id", data.company.id);
        if (error) throw error;
      }
      toast.success("CSD guardado correctamente");
      setCerFile(null);
      setKeyFile(null);
      setCsdPassword("");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos guardar el CSD");
    } finally {
      setSavingCsd(false);
    }
  }

  const current = form ?? {
    legal_name: data?.company?.legal_name ?? "",
    trade_name: data?.company?.trade_name ?? "",
    rfc: data?.company?.rfc ?? "",
    tax_regime: data?.company?.tax_regime ?? "612",
    postal_code: data?.company?.postal_code ?? "",
    email: data?.company?.email ?? data?.user?.email ?? "",
    phone: data?.company?.phone ?? "",
  };

  function set<K extends keyof typeof current>(k: K, v: string) {
    setForm((f) => ({ ...(f ?? current), [k]: v }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const rfcCheck = validateRFC(current.rfc);
    if (!rfcCheck.valid) { toast.error(rfcCheck.reason!); return; }
    if (!current.legal_name.trim()) { toast.error("Razón social requerida"); return; }
    setSaving(true);
    try {
      const userId = data!.user!.id;
      const payload = {
        user_id: userId,
        legal_name: current.legal_name.trim(),
        trade_name: current.trade_name.trim() || null,
        rfc: current.rfc.toUpperCase().trim(),
        tax_regime: current.tax_regime,
        postal_code: current.postal_code.trim() || null,
        email: current.email.trim() || null,
        phone: current.phone.trim() || null,
        is_default: true,
      };
      const { error } = data?.company
        ? await supabase.from("companies").update(payload).eq("id", data.company.id)
        : await supabase.from("companies").insert(payload);
      if (error) throw error;
      toast.success("Perfil guardado");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos guardar");
    } finally {
      setSaving(false);
    }
  }

  async function onSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading) {
    return <div className="grid min-h-dvh place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Perfil del negocio</p>
        <h1 className="text-2xl font-bold tracking-tight">{current.trade_name || current.legal_name || "Mi negocio"}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{data?.user?.email}</p>
      </header>

      <form onSubmit={onSave} className="mt-6 space-y-4">
        <div className="flex items-center gap-2 rounded-2xl bg-primary-soft px-4 py-3 text-xs text-primary">
          <Building2 className="size-4" />
          <span>Esta información se usará al emitir cada CFDI.</span>
        </div>

        <Field label="Razón social">
          <input value={current.legal_name} onChange={(e) => set("legal_name", e.target.value)} className="ff-input" required />
        </Field>
        <Field label="Nombre comercial (opcional)">
          <input value={current.trade_name} onChange={(e) => set("trade_name", e.target.value)} className="ff-input" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="RFC">
            <input value={current.rfc} onChange={(e) => set("rfc", e.target.value.toUpperCase())} className="ff-input font-mono uppercase" maxLength={13} required />
          </Field>
          <Field label="Código postal">
            <input value={current.postal_code} onChange={(e) => set("postal_code", e.target.value)} className="ff-input font-mono" maxLength={5} />
          </Field>
        </div>
        <Field label="Régimen fiscal">
          <select value={current.tax_regime} onChange={(e) => set("tax_regime", e.target.value)} className="ff-input">
            {TAX_REGIMES.map((r) => <option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Correo">
            <input type="email" value={current.email} onChange={(e) => set("email", e.target.value)} className="ff-input" />
          </Field>
          <Field label="Teléfono">
            <input value={current.phone} onChange={(e) => set("phone", e.target.value)} className="ff-input font-mono" />
          </Field>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-semibold text-background transition active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Guardar perfil"}
        </button>
      </form>

      <section className="mt-8 space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cuenta</h2>
        <ProfileLink to="/settings" icon={Settings} title="Configuración" subtitle="Notificaciones, tema, biometría" />
        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left transition active:scale-[0.99]"
        >
          <div className="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
            <LogOut className="size-4" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">Cerrar sesión</p>
            <p className="text-xs text-muted-foreground">Salir de Factura Fácil</p>
          </div>
        </button>
      </section>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
        <ShieldCheck className="size-3" /> Tus datos viajan cifrados y solo tú los ves.
      </p>

      <style>{`.ff-input{width:100%;border-radius:1rem;border:1px solid var(--input);background:var(--surface);padding:0.875rem 1rem;font-size:0.9rem;outline:none}.ff-input:focus{border-color:var(--primary);box-shadow:0 0 0 4px var(--ring)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ProfileLink({ to, icon: Icon, title, subtitle }: { to: string; icon: typeof Settings; title: string; subtitle: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 transition active:scale-[0.99]">
      <div className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-4" />
      </div>
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </Link>
  );
}
