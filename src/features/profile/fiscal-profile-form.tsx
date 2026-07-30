import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { taxRegimesForPersonType, type PersonType } from "@/lib/sat-catalogs";
import { validateRFC } from "@/lib/format";
import { classifyRfc } from "@/lib/fiscal";
import type { CompanyProfileData } from "./company-profile";

type FiscalForm = {
  legal_name: string;
  trade_name: string;
  rfc: string;
  tax_regime: string;
  postal_code: string;
  email: string;
  phone: string;
};

export function FiscalProfileForm({ profile }: { profile: CompanyProfileData }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FiscalForm | null>(null);
  const current = form ?? {
    legal_name: profile.company?.legal_name ?? "",
    trade_name: profile.company?.trade_name ?? "",
    rfc: profile.company?.rfc ?? "",
    tax_regime: profile.company?.tax_regime ?? "612",
    postal_code: profile.company?.postal_code ?? "",
    email: profile.company?.email ?? profile.user.email ?? "",
    phone: profile.company?.phone ?? "",
  };

  function set<K extends keyof FiscalForm>(key: K, value: FiscalForm[K]) {
    setForm((previous) => ({ ...(previous ?? current), [key]: value }));
  }

  // Detecta persona física (RFC de 13) o moral (RFC de 12) para filtrar el
  // régimen fiscal a solo las opciones que el SAT permite para cada una.
  const personType: PersonType | null = useMemo(() => {
    const kind = classifyRfc(current.rfc);
    if (kind === "physical") return "fisica";
    if (kind === "moral") return "moral";
    return null;
  }, [current.rfc]);
  const availableRegimes = useMemo(() => taxRegimesForPersonType(personType), [personType]);

  function setRfc(value: string) {
    const upper = value.toUpperCase();
    const nextKind = classifyRfc(upper);
    const nextPersonType = nextKind === "physical" ? "fisica" : nextKind === "moral" ? "moral" : null;
    const regimesForNext = taxRegimesForPersonType(nextPersonType);
    const nextTaxRegime = regimesForNext.some((r) => r.code === current.tax_regime)
      ? current.tax_regime
      : "";
    setForm((previous) => ({ ...(previous ?? current), rfc: upper, tax_regime: nextTaxRegime }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const rfcCheck = validateRFC(current.rfc);
    if (!rfcCheck.valid) return toast.error(rfcCheck.reason!);
    if (!current.legal_name.trim()) return toast.error("Razón social requerida");
    if (!current.tax_regime) return toast.error("Selecciona tu régimen fiscal");

    setSaving(true);
    try {
      const payload = {
        user_id: profile.user.id,
        legal_name: current.legal_name.trim(),
        trade_name: current.trade_name.trim() || null,
        rfc: current.rfc.toUpperCase().trim(),
        tax_regime: current.tax_regime,
        postal_code: current.postal_code.trim() || null,
        email: current.email.trim() || null,
        phone: current.phone.trim() || null,
        is_default: true,
      };
      const { error } = profile.company
        ? await supabase.from("companies").update(payload).eq("id", profile.company.id)
        : await supabase.from("companies").insert(payload);
      if (error) throw error;
      toast.success("Perfil fiscal guardado");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["company-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "No pudimos guardar el perfil fiscal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="rounded-2xl bg-primary-soft px-4 py-3 text-xs text-primary">
        Esta información se usará al emitir cada CFDI.
      </div>
      <Field label="Razón social">
        <input value={current.legal_name} onChange={(e) => set("legal_name", e.target.value)} className="ff-input" required />
      </Field>
      <Field label="Nombre comercial (opcional)">
        <input value={current.trade_name} onChange={(e) => set("trade_name", e.target.value)} className="ff-input" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="RFC">
          <input value={current.rfc} onChange={(e) => setRfc(e.target.value)} className="ff-input font-mono uppercase" maxLength={13} required />
        </Field>
        <Field label="Código postal">
          <input value={current.postal_code} onChange={(e) => set("postal_code", e.target.value)} className="ff-input font-mono" maxLength={5} />
        </Field>
      </div>
      <Field label="Régimen fiscal">
        <select value={current.tax_regime} onChange={(e) => set("tax_regime", e.target.value)} className="ff-input">
          <option value="">Selecciona tu régimen…</option>
          {availableRegimes.map((regime) => <option key={regime.code} value={regime.code}>{regime.code} — {regime.name}</option>)}
        </select>
        {personType && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Detectado por tu RFC: <strong>{personType === "fisica" ? "Persona Física" : "Persona Moral"}</strong> — solo se muestran los regímenes aplicables.
          </p>
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Correo"><input type="email" value={current.email} onChange={(e) => set("email", e.target.value)} className="ff-input" /></Field>
        <Field label="Teléfono"><input value={current.phone} onChange={(e) => set("phone", e.target.value)} className="ff-input font-mono" /></Field>
      </div>
      <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-semibold text-background transition active:scale-[0.98] disabled:opacity-60">
        {saving ? <Loader2 className="size-4 animate-spin" /> : "Guardar perfil fiscal"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>{children}</label>;
}
