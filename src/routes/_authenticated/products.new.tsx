import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { COMMON_SAT_KEYS, COMMON_SAT_UNITS } from "@/lib/sat-catalogs";
import { useQueryClient } from "@tanstack/react-query";
import { SatKeyPicker } from "@/components/sat-key-picker";

export const Route = createFileRoute("/_authenticated/products/new")({
  component: NewProduct,
});

type ServiceType = { id: string; name: string; sat_key: string; sat_unit: string };

const OTHER_SERVICE = "__other__";

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

  // Perfil de actividad de la empresa (Parte 1 de clasificación fiscal): si
  // existe, ofrecemos un catálogo simplificado de servicios con clave y
  // unidad SAT ya asignadas, con "Otro servicio" como salida al formulario avanzado.
  const [profileLoading, setProfileLoading] = useState(true);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const hasProfile = serviceTypes.length > 0;
  const [kind, setKind] = useState<"servicio" | "producto">("servicio");
  const [serviceTypeId, setServiceTypeId] = useState<string>("");

  const returnTo = useMemo(() => new URLSearchParams(window.location.search).get("return_to"), []);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setProfileLoading(false);
        return;
      }
      const { data: company } = await supabase
        .from("companies")
        .select("activity_profile_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (company?.activity_profile_id) {
        const { data: types } = await supabase
          .from("activity_profile_service_types")
          .select("id, name, sat_key, sat_unit")
          .eq("activity_profile_id", company.activity_profile_id)
          .eq("is_active", true)
          .order("sort_order");
        setServiceTypes(types ?? []);
      }
      setProfileLoading(false);
    })();
  }, []);

  const showSimplifiedService =
    hasProfile && kind === "servicio" && serviceTypeId !== OTHER_SERVICE;
  const showAdvancedForm = !hasProfile || kind === "producto" || serviceTypeId === OTHER_SERVICE;

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onSelectServiceType(id: string) {
    setServiceTypeId(id);
    if (id === OTHER_SERVICE || id === "") {
      return;
    }
    const type = serviceTypes.find((t) => t.id === id);
    if (type) {
      setForm((f) => ({
        ...f,
        description: type.name,
        sat_key: type.sat_key,
        sat_unit: type.sat_unit,
      }));
    }
  }

  function onKindChange(next: "servicio" | "producto") {
    setKind(next);
    setServiceTypeId("");
    if (next === "producto") {
      setForm((f) => ({ ...f, description: "", sat_key: "01010101", sat_unit: "E48" }));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (showSimplifiedService && !serviceTypeId) {
      toast.error("Selecciona el tipo de servicio");
      return;
    }
    if (!form.description.trim()) {
      toast.error("El nombre del producto o servicio es requerido");
      return;
    }
    const price = parseFloat(form.unit_price);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Precio inválido");
      return;
    }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: inserted, error } = await supabase
        .from("products")
        .insert({
          user_id: userData.user!.id,
          description: form.description.trim(),
          sat_key: form.sat_key,
          sat_unit: form.sat_unit,
          unit_price: price,
          iva_rate: parseFloat(form.iva_rate),
          internal_code: form.internal_code.trim() || null,
          category: form.category.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success(showSimplifiedService ? "Servicio agregado" : "Producto agregado");
      qc.invalidateQueries({ queryKey: ["products"] });
      if (returnTo === "invoice") {
        window.location.href = `/invoices/new?resume_product=${inserted.id}`;
        return;
      }
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
        {returnTo === "invoice" ? (
          <a
            href="/invoices/new"
            className="grid size-10 place-items-center rounded-full border border-border bg-surface"
          >
            <ArrowLeft className="size-4" />
          </a>
        ) : (
          <Link
            to="/products"
            className="grid size-10 place-items-center rounded-full border border-border bg-surface"
          >
            <ArrowLeft className="size-4" />
          </Link>
        )}
        <h1 className="text-xl font-bold tracking-tight">
          {showSimplifiedService
            ? "Nuevo servicio"
            : hasProfile
              ? "Nuevo producto o servicio"
              : "Nuevo producto"}
        </h1>
      </header>

      {!profileLoading && hasProfile && (
        <div className="mt-6 flex gap-2 rounded-2xl bg-muted p-1">
          <button
            type="button"
            onClick={() => onKindChange("servicio")}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${kind === "servicio" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            Servicio
          </button>
          <button
            type="button"
            onClick={() => onKindChange("producto")}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${kind === "producto" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            Producto
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {hasProfile && kind === "servicio" && (
          <Field label="Tipo de servicio">
            <select
              value={serviceTypeId}
              onChange={(e) => onSelectServiceType(e.target.value)}
              className="ff-input"
              required
            >
              <option value="" disabled>
                Selecciona uno…
              </option>
              {serviceTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value={OTHER_SERVICE}>Otro servicio…</option>
            </select>
          </Field>
        )}

        {showSimplifiedService && (
          <>
            <Field label="Nombre del servicio" hint="Así aparecerá en tus facturas">
              <input
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className="ff-input"
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Precio unitario (MXN)">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={form.unit_price}
                    onChange={(e) => set("unit_price", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0.00"
                    className="ff-input pl-7 font-mono"
                    required
                  />
                </div>
              </Field>
              <Field
                label="IVA"
                hint="16% aplica casi siempre. Usa 8% solo si facturas desde zona fronteriza."
              >
                <select
                  value={form.iva_rate}
                  onChange={(e) => set("iva_rate", e.target.value)}
                  className="ff-input"
                >
                  <option value="0.16">16%</option>
                  <option value="0.08">8% (frontera)</option>
                  <option value="0">0% / Exento</option>
                </select>
              </Field>
            </div>
          </>
        )}

        {showAdvancedForm && (
          <>
            <Field label="Nombre del producto o servicio" hint="Así aparecerá en tus facturas">
              <input
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Ej. Servicio de consultoría, Playera talla M…"
                className="ff-input"
                required
              />
            </Field>
            <Field
              label="Clave SAT"
              hint="Describe qué vendes; el SAT usa este código para clasificarlo. Si no encuentras algo parecido, usa «No existe en el catálogo»."
            >
              <SatKeyPicker
                value={form.sat_key}
                onChange={(code) => set("sat_key", code)}
                items={COMMON_SAT_KEYS}
              />
            </Field>
            <Field
              label="Unidad SAT"
              hint="Cómo se mide lo que vendes (por servicio, por hora, por pieza…)."
            >
              <select
                value={form.sat_unit}
                onChange={(e) => set("sat_unit", e.target.value)}
                className="ff-input"
              >
                {COMMON_SAT_UNITS.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.code} — {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Precio unitario (MXN)">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={form.unit_price}
                    onChange={(e) => set("unit_price", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="0.00"
                    className="ff-input pl-7 font-mono"
                    required
                  />
                </div>
              </Field>
              <Field
                label="IVA"
                hint="16% aplica casi siempre. Usa 8% solo si facturas desde zona fronteriza."
              >
                <select
                  value={form.iva_rate}
                  onChange={(e) => set("iva_rate", e.target.value)}
                  className="ff-input"
                >
                  <option value="0.16">16%</option>
                  <option value="0.08">8% (frontera)</option>
                  <option value="0">0% / Exento</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Código interno (opcional)"
                hint="Para tu propio catálogo; no aparece en la factura."
              >
                <input
                  value={form.internal_code}
                  onChange={(e) => set("internal_code", e.target.value)}
                  placeholder="PROD-001"
                  className="ff-input font-mono"
                />
              </Field>
              <Field label="Categoría (opcional)" hint="Te ayuda a organizar tu catálogo.">
                <input
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  placeholder="Servicios"
                  className="ff-input"
                />
              </Field>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-semibold text-background transition active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
        </button>
      </form>

      <style>{`.ff-input{width:100%;border-radius:1rem;border:1px solid var(--input);background:var(--surface);padding:0.875rem 1rem;font-size:0.9rem;outline:none}.ff-input:focus{border-color:var(--primary);box-shadow:0 0 0 4px var(--ring)}`}</style>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
