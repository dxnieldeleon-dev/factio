import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { COMMON_SAT_KEYS, COMMON_SAT_UNITS } from "@/lib/sat-catalogs";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/products/new")({
  component: NewProduct,
});

function NewProduct() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    description: "",
    sat_key: "01010101",
    sat_unit: "E48",
    unit_price: "",
    iva_rate: "0.16",
    internal_code: "",
    category: "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim()) { toast.error("La descripción es requerida"); return; }
    const price = parseFloat(form.unit_price);
    if (!Number.isFinite(price) || price < 0) { toast.error("Precio inválido"); return; }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("products").insert({
        user_id: userData.user!.id,
        description: form.description.trim(),
        sat_key: form.sat_key,
        sat_unit: form.sat_unit,
        unit_price: price,
        iva_rate: parseFloat(form.iva_rate),
        internal_code: form.internal_code.trim() || null,
        category: form.category.trim() || null,
      });
      if (error) throw error;
      toast.success("Producto agregado");
      qc.invalidateQueries({ queryKey: ["products"] });
      navigate({ to: "/products" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos guardar el producto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
      <header className="flex items-center gap-3">
        <Link to="/products" className="grid size-10 place-items-center rounded-full border border-border bg-surface">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-xl font-bold tracking-tight">Nuevo producto</h1>
      </header>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Field label="Descripción">
          <input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Servicio de consultoría" className="ff-input" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Clave SAT">
            <select value={form.sat_key} onChange={(e) => set("sat_key", e.target.value)} className="ff-input">
              {COMMON_SAT_KEYS.map((k) => <option key={k.code} value={k.code}>{k.code}</option>)}
            </select>
          </Field>
          <Field label="Unidad SAT">
            <select value={form.sat_unit} onChange={(e) => set("sat_unit", e.target.value)} className="ff-input">
              {COMMON_SAT_UNITS.map((u) => <option key={u.code} value={u.code}>{u.code} — {u.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio unitario (MXN)">
            <input type="number" inputMode="decimal" step="0.01" min="0" value={form.unit_price} onChange={(e) => set("unit_price", e.target.value)} placeholder="0.00" className="ff-input font-mono" required />
          </Field>
          <Field label="IVA">
            <select value={form.iva_rate} onChange={(e) => set("iva_rate", e.target.value)} className="ff-input">
              <option value="0.16">16%</option>
              <option value="0.08">8% (frontera)</option>
              <option value="0">0% / Exento</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Código interno (opcional)">
            <input value={form.internal_code} onChange={(e) => set("internal_code", e.target.value)} placeholder="PROD-001" className="ff-input font-mono" />
          </Field>
          <Field label="Categoría (opcional)">
            <input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Servicios" className="ff-input" />
          </Field>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-semibold text-background transition active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Guardar producto"}
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
