import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateRFC } from "@/lib/format";
import { TAX_REGIMES, CFDI_USES } from "@/lib/sat-catalogs";
import { useQueryClient } from "@tanstack/react-query";

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
    cfdi_use: "G03",
    email: "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rfcCheck = validateRFC(form.rfc);
    if (!rfcCheck.valid) { toast.error(rfcCheck.reason!); return; }
    if (!form.legal_name.trim()) { toast.error("La razón social es requerida"); return; }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("clients").insert({
        user_id: userData.user!.id,
        rfc: form.rfc.toUpperCase().trim(),
        legal_name: form.legal_name.trim(),
        tax_regime: form.tax_regime,
        postal_code: form.postal_code.trim() || null,
        cfdi_use: form.cfdi_use,
        email: form.email.trim() || null,
      });
      if (error) throw error;
      toast.success("Cliente agregado");
      qc.invalidateQueries({ queryKey: ["clients"] });
      navigate({ to: "/clients" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos guardar el cliente");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
      <header className="flex items-center gap-3">
        <Link to="/clients" className="grid size-10 place-items-center rounded-full border border-border bg-surface">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Nuevo cliente</h1>
      </header>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="RFC">
          <input
            value={form.rfc}
            onChange={(e) => set("rfc", e.target.value.toUpperCase())}
            placeholder="XAXX010101000"
            maxLength={13}
            className="ff-input font-mono uppercase tracking-wider"
            autoCapitalize="characters"
            required
          />
        </Field>
        <Field label="Razón social">
          <input value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} placeholder="Nombre o razón social" className="ff-input" required />
        </Field>
        <Field label="Régimen fiscal">
          <select value={form.tax_regime} onChange={(e) => set("tax_regime", e.target.value)} className="ff-input">
            {TAX_REGIMES.map((r) => <option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Código postal">
            <input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} placeholder="00000" maxLength={5} className="ff-input font-mono" />
          </Field>
          <Field label="Uso CFDI">
            <select value={form.cfdi_use} onChange={(e) => set("cfdi_use", e.target.value)} className="ff-input">
              {CFDI_USES.map((u) => <option key={u.code} value={u.code}>{u.code}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Correo (opcional)">
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="cliente@correo.com" className="ff-input" />
        </Field>

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
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
