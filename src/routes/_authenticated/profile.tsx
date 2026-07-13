import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  LogOut, Building2, Settings, Loader2, ShieldCheck, Eye, EyeOff, Upload,
  CheckCircle2, AlertTriangle, CreditCard, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TAX_REGIMES } from "@/lib/sat-catalogs";
import { validateRFC } from "@/lib/format";


export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
});

interface PlanRow {
  id: string; key: string; nombre: string; precio_mxn: number;
  facturas_incluidas: number; features: Record<string, boolean>;
}
interface SubscriptionRow {
  id: string; plan_id: string; status: string; current_period_end: string | null;
}

async function loadProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", userData.user!.id)
    .maybeSingle();

  const [plansRes, subRes, walletRes] = await Promise.all([
    supabase.from("plans").select("id, key, nombre, precio_mxn, facturas_incluidas, features").eq("is_active", true).order("precio_mxn"),
    company
      ? supabase.from("subscriptions").select("id, plan_id, status, current_period_end").eq("company_id", company.id).maybeSingle()
      : Promise.resolve({ data: null }),
    company
      ? supabase.from("stamp_wallets").select("balance").eq("company_id", company.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    user: userData.user,
    company,
    plans: (plansRes.data as PlanRow[]) ?? [],
    subscription: subRes.data as SubscriptionRow | null,
    walletBalance: (walletRes.data as { balance?: number } | null)?.balance ?? null,
  };
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
  const [csdError, setCsdError] = useState<string | null>(null);

  const [showPlans, setShowPlans] = useState(false);
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null);

  // Maneja el redirect de vuelta desde Stripe Checkout (?suscripcion=exito|cancelada)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const estado = params.get("suscripcion");
    if (estado === "exito") {
      toast.success("¡Suscripción activada! Puede tardar unos segundos en reflejarse.");
      qc.invalidateQueries({ queryKey: ["profile"] });
    } else if (estado === "cancelada") {
      toast.info("Pago cancelado. No se realizó ningún cargo.");
    }
    if (estado) {
      params.delete("suscripcion");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasCsdConfigured = !!(
    data?.company?.csd_cer_url &&
    data?.company?.csd_key_url &&
    data?.company?.csd_serial_number &&
    data?.company?.csd_valid_to
  );
  const canSaveCsd = (!!cerFile || !!keyFile || !!data?.company?.csd_cer_url) && csdPassword.length > 0;

  const activeSub = data?.subscription && (data.subscription.status === "active" || data.subscription.status === "trialing")
    ? data.subscription
    : null;
  const activePlan = activeSub ? data?.plans.find((p) => p.id === activeSub.plan_id) ?? null : null;
  const used = activePlan ? activePlan.facturas_incluidas - (data?.walletBalance ?? 0) : 0;
  const usagePct = activePlan ? Math.min(100, Math.max(0, (used / activePlan.facturas_incluidas) * 100)) : 0;

  async function onSaveCsd() {
    if (!data?.user) return;
    if (!data.company) {
      toast.error("Primero guarda los datos fiscales del perfil");
      return;
    }
    setSavingCsd(true);
    setCsdError(null);
    try {
      const userId = data.user.id;
      const companyId = data.company.id;
      const updates: { csd_cer_url?: string; csd_key_url?: string } = {};

      if (cerFile) {
        const path = `${userId}/${companyId}/cert.cer`;
        const { error } = await supabase.storage.from("csd-files").upload(path, cerFile, { upsert: true });
        if (error) throw error;
        updates.csd_cer_url = path;
      }
      if (keyFile) {
        const path = `${userId}/${companyId}/key.key`;
        const { error } = await supabase.storage.from("csd-files").upload(path, keyFile, { upsert: true });
        if (error) throw error;
        updates.csd_key_url = path;
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("companies").update(updates).eq("id", companyId);
        if (error) throw error;
      }

      // La validación real (¿la contraseña abre el .key? ¿el .key corresponde
      // al .cer?) ocurre en el servidor. La contraseña viaja solo en esta
      // llamada y nunca se guarda en ningún lado.
      const { data: result, error: fnError } = await supabase.functions.invoke("validar-csd", {
        body: { company_id: companyId, password: csdPassword },
      });

      if (fnError) throw fnError;
      if (!result?.success) {
        setCsdError(result?.error ?? "No pudimos validar tu CSD.");
        toast.error(result?.error ?? "No pudimos validar tu CSD.");
        return;
      }

      toast.success("CSD validado y guardado correctamente");
      setCerFile(null);
      setKeyFile(null);
      setCsdPassword("");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No pudimos guardar el CSD";
      setCsdError(message);
      toast.error(message);
    } finally {
      setSavingCsd(false);
    }
  }

  async function onSubscribe(planKey: string) {
    setSubscribingPlan(planKey);
    try {
      const { data: result, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { plan_key: planKey },
      });
      if (error) throw error;
      if (!result?.success || !result?.url) {
        toast.error(result?.error ?? "No pudimos iniciar el pago.");
        return;
      }
      window.location.href = result.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos iniciar el pago.");
    } finally {
      setSubscribingPlan(null);
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

      <section className="mt-8 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Certificado de Sello Digital (CSD)</h2>

        {hasCsdConfigured ? (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="size-3.5" /> CSD Configurado
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-semibold text-amber-800">
            <AlertTriangle className="size-3.5" /> Sin CSD — No podrás timbrar
          </div>
        )}

        <input
          ref={cerInputRef}
          type="file"
          accept=".cer"
          className="hidden"
          onChange={(e) => setCerFile(e.target.files?.[0] ?? null)}
        />
        <input
          ref={keyInputRef}
          type="file"
          accept=".key"
          className="hidden"
          onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)}
        />

        <Field label="Certificado (.cer)">
          <button
            type="button"
            onClick={() => cerInputRef.current?.click()}
            className="ff-input flex items-center justify-between gap-2 text-left"
          >
            <span className="flex items-center gap-2 truncate text-sm">
              <Upload className="size-4 text-muted-foreground shrink-0" />
              <span className="truncate">{cerFile?.name ?? "Seleccionar archivo .cer"}</span>
            </span>
            <span className="text-xs text-primary font-semibold">{cerFile ? "Cambiar" : "Subir"}</span>
          </button>
          {!cerFile && data?.company?.csd_cer_url && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-700">
              <CheckCircle2 className="size-3" /> Archivo cargado
            </p>
          )}
        </Field>

        <Field label="Llave privada (.key)">
          <button
            type="button"
            onClick={() => keyInputRef.current?.click()}
            className="ff-input flex items-center justify-between gap-2 text-left"
          >
            <span className="flex items-center gap-2 truncate text-sm">
              <Upload className="size-4 text-muted-foreground shrink-0" />
              <span className="truncate">{keyFile?.name ?? "Seleccionar archivo .key"}</span>
            </span>
            <span className="text-xs text-primary font-semibold">{keyFile ? "Cambiar" : "Subir"}</span>
          </button>
          {!keyFile && data?.company?.csd_key_url && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-700">
              <CheckCircle2 className="size-3" /> Archivo cargado
            </p>
          )}
        </Field>

        <Field label="Contraseña del CSD">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={csdPassword}
              onChange={(e) => setCsdPassword(e.target.value)}
              placeholder="Contraseña de tu llave privada"
              className="ff-input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label={showPassword ? "Ocultar" : "Mostrar"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Esta es la contraseña que elegiste al generar tu CSD en el portal del SAT. Nunca se guarda: solo se usa para validar y se descarta de inmediato.
          </p>
        </Field>

        {csdError && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-[12px] text-destructive">{csdError}</p>
        )}

        <button
          type="button"
          onClick={onSaveCsd}
          disabled={!canSaveCsd || savingCsd}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-semibold text-background transition active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {savingCsd ? <Loader2 className="size-4 animate-spin" /> : "Guardar CSD"}
        </button>

        <p className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-[11px] text-amber-800">
          <ShieldCheck className="size-3.5 mt-0.5 shrink-0" />
          Tus archivos CSD se almacenan cifrados y solo son accesibles por ti. Nunca se comparten con terceros.
        </p>
      </section>

      {/* -------- Suscripción -------- */}
      <section className="mt-8 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Suscripción</h2>

        {activePlan && activeSub ? (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{activePlan.nombre}</p>
                <p className="text-xs text-muted-foreground">${activePlan.precio_mxn} MXN/mes</p>
              </div>
              <CreditCard className="size-5 text-primary" />
            </div>

            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Llevas {used} de {activePlan.facturas_incluidas} facturas este mes</span>
                <span>{Math.round(usagePct)}%</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${usagePct >= 100 ? "bg-destructive" : "bg-primary"}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>

            {activeSub.current_period_end && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Se renueva el {new Date(activeSub.current_period_end).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}
              </p>
            )}

            {(data?.walletBalance ?? 0) <= 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-[11px] text-amber-800">
                <Zap className="size-3.5 mt-0.5 shrink-0" />
                Se te acabaron los timbres de este mes. Sube de plan para seguir facturando.
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowPlans((v) => !v)}
              className="mt-3 w-full rounded-xl border border-border bg-background py-2.5 text-xs font-semibold text-foreground"
            >
              {showPlans ? "Ocultar planes" : "Ver otros planes"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Aún no tienes una suscripción activa. Elige un plan para poder timbrar tus facturas.
          </p>
        )}

        {(!activePlan || showPlans) && (
          <div className="space-y-2.5">
            {(data?.plans ?? []).map((p) => (
              <div key={p.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">${p.precio_mxn} MXN/mes · Hasta {p.facturas_incluidas} facturas</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSubscribe(p.key)}
                    disabled={subscribingPlan === p.key}
                    className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-60"
                  >
                    {subscribingPlan === p.key ? <Loader2 className="size-3.5 animate-spin" /> : "Suscribirme"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
            <p className="text-xs text-muted-foreground">Salir de Factio</p>
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
