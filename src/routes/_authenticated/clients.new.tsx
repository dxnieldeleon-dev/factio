import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateRFC } from "@/lib/format";
import { classifyRfc } from "@/lib/fiscal";
import { taxRegimesForPersonType, type PersonType } from "@/lib/sat-catalogs";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/clients/new")({
  component: NewClient,
});

function NewClient() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    rfc: "",
    legal_name: "",
    tax_regime: "612",
    postal_code: "",
    email: "",
    phone: "",
  });
  const [isTechnologyPlatform, setIsTechnologyPlatform] = useState(false);

  const returnTo = useMemo(() => new URLSearchParams(window.location.search).get("return_to"), []);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Detecta persona física (RFC de 13) o moral (RFC de 12) para filtrar el
  // régimen fiscal a solo las opciones que el SAT permite para cada una.
  const personType: PersonType | null = useMemo(() => {
    const kind = classifyRfc(form.rfc);
    if (kind === "physical") return "fisica";
    if (kind === "moral") return "moral";
    return null;
  }, [form.rfc]);
  const availableRegimes = useMemo(() => taxRegimesForPersonType(personType), [personType]);

  function setRfc(value: string) {
    const upper = value.toUpperCase();
    const nextKind = classifyRfc(upper);
    const nextPersonType =
      nextKind === "physical" ? "fisica" : nextKind === "moral" ? "moral" : null;
    const regimesForNext = taxRegimesForPersonType(nextPersonType);
    setForm((f) => ({
      ...f,
      rfc: upper,
      tax_regime: regimesForNext.some((r) => r.code === f.tax_regime) ? f.tax_regime : "",
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rfcCheck = validateRFC(form.rfc);
    if (!rfcCheck.valid) {
      toast.error(rfcCheck.reason!);
      return;
    }
    if (!form.legal_name.trim()) {
      toast.error("La razón social es requerida");
      return;
    }
    if (!/^\d{5}$/.test(form.postal_code.trim())) {
      toast.error("El código postal debe tener 5 dígitos");
      return;
    }
    if (!form.tax_regime) {
      toast.error("Selecciona un régimen fiscal");
      return;
    }
    setLoading(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Sesión expirada, vuelve a iniciar sesión");
      const { data: inserted, error } = await supabase
        .from("clients")
        .insert({
          user_id: userData.user.id,
          rfc: form.rfc.toUpperCase().trim(),
          legal_name: form.legal_name.trim(),
          tax_regime: form.tax_regime,
          postal_code: form.postal_code.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          is_technology_platform: isTechnologyPlatform,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Cliente agregado");
      qc.invalidateQueries({ queryKey: ["clients"] });
      if (returnTo === "invoice") {
        window.location.href = `/invoices/new?resume_client=${inserted.id}`;
        return;
      }
      navigate({ to: "/clients" });
    } catch (err) {
      console.error("[clients.new] insert failed", err);
      toast.error(err instanceof Error ? err.message : "No pudimos guardar el cliente");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
      <header className="flex items-center gap-3">
        {returnTo === "invoice" ? (
          <a
            href="/invoices/new"
            className="grid size-10 place-items-center rounded-full border border-border bg-surface"
          >
            <ArrowLeft className="size-4" />
          </a>
        ) : (
          <Link
            to="/clients"
            className="grid size-10 place-items-center rounded-full border border-border bg-surface"
          >
            <ArrowLeft className="size-4" />
          </Link>
        )}
        <h1 className="text-xl font-bold tracking-tight">Nuevo cliente</h1>
      </header>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="RFC">
          <input
            value={form.rfc}
            onChange={(e) => setRfc(e.target.value)}
            placeholder="XAXX010101000"
            maxLength={13}
            className="ff-input font-mono uppercase tracking-wider"
            autoCapitalize="characters"
            required
          />
        </Field>
        <Field label="Razón social">
          <input
            value={form.legal_name}
            onChange={(e) => set("legal_name", e.target.value)}
            placeholder="Nombre o razón social"
            className="ff-input"
            required
          />
        </Field>
        <Field label="Régimen fiscal">
          <select
            value={form.tax_regime}
            onChange={(e) => set("tax_regime", e.target.value)}
            className="ff-input"
          >
            <option value="">Selecciona un régimen…</option>
            {availableRegimes.map((r) => (
              <option key={r.code} value={r.code}>
                {r.code} — {r.name}
              </option>
            ))}
          </select>
          {personType && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Detectado por el RFC:{" "}
              <strong>{personType === "fisica" ? "Persona Física" : "Persona Moral"}</strong> — solo
              se muestran los regímenes aplicables.
            </p>
          )}
        </Field>
        <Field label="Código postal">
          <input
            value={form.postal_code}
            onChange={(e) => set("postal_code", e.target.value.replace(/\D/g, ""))}
            placeholder="00000"
            maxLength={5}
            inputMode="numeric"
            pattern="\d{5}"
            className="ff-input font-mono"
            required
          />
        </Field>
        <Field label="Correo (opcional)">
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="cliente@correo.com"
            className="ff-input"
          />
        </Field>
        <Field label="Teléfono (opcional)">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="55 1234 5678"
            inputMode="tel"
            className="ff-input"
          />
        </Field>

        <label className="flex items-center justify-between gap-3 py-1">
          <span className="text-xs text-muted-foreground">
            Es una plataforma tecnológica (Uber, Didi, Airbnb, etc.)
          </span>
          <Switch checked={isTechnologyPlatform} onCheckedChange={setIsTechnologyPlatform} />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-semibold text-background transition active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Guardar cliente"}
        </button>
      </form>

      <style>{`.ff-input{width:100%;border-radius:1rem;border:1px solid var(--input);background:var(--surface);padding:0.875rem 1rem;font-size:0.9rem;outline:none}.ff-input:focus{border-color:var(--primary);box-shadow:0 0 0 4px var(--ring)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
