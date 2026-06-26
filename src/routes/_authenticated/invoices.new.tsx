import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Search, Plus, Trash2, Check, Loader2, FileCheck2, Download, Share2, Home, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatMXN } from "@/lib/format";
import { CFDI_USES, PAYMENT_FORMS, PAYMENT_METHODS, COMMON_SAT_KEYS, COMMON_SAT_UNITS } from "@/lib/sat-catalogs";
import { pac } from "@/lib/pac";

export const Route = createFileRoute("/_authenticated/invoices/new")({
  component: NewInvoice,
});

interface ClientRow {
  id: string; legal_name: string; rfc: string; tax_regime: string | null;
  postal_code: string | null; cfdi_use: string | null; email: string | null;
}
interface ProductRow {
  id: string; description: string; sat_key: string; sat_unit: string;
  unit_price: number; iva_rate: number;
}
interface LineItem {
  sat_key: string; sat_unit: string; description: string;
  quantity: number; unit_price: number; discount: number; iva_rate: number;
  product_id?: string;
}

type Step = 1 | 2 | 3 | 4;

function NewInvoice() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>(1);
  const [client, setClient] = useState<ClientRow | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("PUE");
  const [paymentForm, setPaymentForm] = useState("03");
  const [cfdiUse, setCfdiUse] = useState("G03");
  const [issuing, setIssuing] = useState(false);
  const [result, setResult] = useState<{ id: string; series: string; folio: number; uuid: string; xmlUrl: string } | null>(null);

  const totals = useMemo(() => {
    const subtotal = items.reduce((a, i) => a + (i.quantity * i.unit_price - i.discount), 0);
    const ivaTotal = items.reduce((a, i) => a + (i.quantity * i.unit_price - i.discount) * i.iva_rate, 0);
    return { subtotal, ivaTotal, total: subtotal + ivaTotal };
  }, [items]);

  async function onIssue() {
    if (!client) return;
    if (items.length === 0) { toast.error("Agrega al menos un concepto"); return; }
    setIssuing(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data: company } = await supabase.from("companies").select("*").eq("user_id", u.user!.id).maybeSingle();
      if (!company) {
        toast.error("Configura tu perfil del negocio antes de facturar.");
        navigate({ to: "/profile" });
        return;
      }

      // Calcular folio siguiente
      const { data: lastFolio } = await supabase
        .from("invoices").select("folio").eq("user_id", u.user!.id).eq("series", "A")
        .order("folio", { ascending: false }).limit(1).maybeSingle();
      const folio = (lastFolio?.folio ?? 0) + 1;

      // Llamar al PAC stub
      const stamp = await pac.stamp({
        series: "A",
        folio,
        issuerRfc: company.rfc,
        receiverRfc: client.rfc,
        receiverName: client.legal_name,
        receiverTaxRegime: client.tax_regime ?? "",
        receiverCfdiUse: cfdiUse,
        receiverPostalCode: client.postal_code ?? "",
        paymentForm,
        paymentMethod,
        currency: "MXN",
        items: items.map((i) => ({
          satKey: i.sat_key, satUnit: i.sat_unit, description: i.description,
          quantity: i.quantity, unitPrice: i.unit_price, discount: i.discount, ivaRate: i.iva_rate,
        })),
      });

      if (!stamp.ok) {
        toast.error(`Error PAC: ${stamp.message}`);
        return;
      }

      const { data: invoice, error } = await supabase.from("invoices").insert({
        user_id: u.user!.id,
        company_id: company.id,
        client_id: client.id,
        client_snapshot: { legal_name: client.legal_name, rfc: client.rfc, cfdi_use: cfdiUse, tax_regime: client.tax_regime },
        series: "A",
        folio,
        uuid_fiscal: stamp.uuid,
        status: "issued",
        payment_method: paymentMethod,
        payment_form: paymentForm,
        cfdi_use: cfdiUse,
        currency: "MXN",
        subtotal: totals.subtotal,
        iva_total: totals.ivaTotal,
        total: totals.total,
        xml_url: stamp.xmlUrl,
        issued_at: stamp.stampedAt,
      }).select("id").single();
      if (error) throw error;

      const itemRows = items.map((i, idx) => ({
        invoice_id: invoice.id,
        user_id: u.user!.id,
        product_id: i.product_id ?? null,
        sat_key: i.sat_key,
        sat_unit: i.sat_unit,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
        iva_rate: i.iva_rate,
        iva_amount: (i.quantity * i.unit_price - i.discount) * i.iva_rate,
        amount: i.quantity * i.unit_price - i.discount,
        position: idx,
      }));
      await supabase.from("invoice_items").insert(itemRows);

      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["invoices", "history"] });

      setResult({ id: invoice.id, series: "A", folio, uuid: stamp.uuid, xmlUrl: stamp.xmlUrl });
      setStep(4);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos emitir la factura");
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
      <header className="flex items-center gap-3">
        <button
          onClick={() => (step > 1 && step < 4 ? setStep((step - 1) as Step) : navigate({ to: "/dashboard" }))}
          className="grid size-10 place-items-center rounded-full border border-border bg-surface"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Paso {Math.min(step, 3)} de 3</p>
          <h1 className="text-lg font-bold tracking-tight">
            {step === 1 ? "Selecciona cliente" : step === 2 ? "Agrega conceptos" : step === 3 ? "Revisa y emite" : "Factura emitida"}
          </h1>
        </div>
      </header>

      <div className="mt-4 flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-1 flex-1 rounded-full ${n <= Math.min(step, 3) ? "bg-foreground" : "bg-muted"}`} />
        ))}
      </div>

      <div className="mt-6">
        {step === 1 && <StepClient onPick={(c) => { setClient(c); setCfdiUse(c.cfdi_use ?? "G03"); setStep(2); }} />}
        {step === 2 && (
          <StepItems
            items={items}
            setItems={setItems}
            onNext={() => items.length > 0 ? setStep(3) : toast.error("Agrega al menos un concepto")}
          />
        )}
        {step === 3 && client && (
          <StepReview
            client={client}
            items={items}
            totals={totals}
            paymentMethod={paymentMethod}
            paymentForm={paymentForm}
            cfdiUse={cfdiUse}
            setPaymentMethod={setPaymentMethod}
            setPaymentForm={setPaymentForm}
            setCfdiUse={setCfdiUse}
            onIssue={onIssue}
            issuing={issuing}
          />
        )}
        {step === 4 && result && <StepSuccess result={result} />}
      </div>
    </div>
  );
}

/* -------- Step 1: Client -------- */
function StepClient({ onPick }: { onPick: (c: ClientRow) => void }) {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["clients", "picker"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, legal_name, rfc, tax_regime, postal_code, cfdi_use, email").order("is_favorite", { ascending: false }).order("legal_name");
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });
  const filtered = (data ?? []).filter((c) => !q || c.legal_name.toLowerCase().includes(q.toLowerCase()) || c.rfc.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por RFC o nombre…"
          className="w-full rounded-2xl border border-input bg-surface py-3 pl-11 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring"
        />
      </div>
      <Link to="/clients/new" className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-surface py-3 text-sm font-semibold text-primary">
        <Plus className="size-4" /> Crear nuevo cliente
      </Link>
      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl border border-border bg-surface" />)}</div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin clientes que coincidan.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onPick(c)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-left transition active:scale-[0.99]"
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold uppercase text-primary">
                    {c.legal_name.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.legal_name}</p>
                    <p className="font-mono text-[10px] uppercase text-muted-foreground">{c.rfc}</p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* -------- Step 2: Items -------- */
function StepItems({ items, setItems, onNext }: { items: LineItem[]; setItems: (i: LineItem[]) => void; onNext: () => void }) {
  const [open, setOpen] = useState(false);
  const { data: products } = useQuery({
    queryKey: ["products", "picker"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, description, sat_key, sat_unit, unit_price, iva_rate").eq("is_active", true).order("description");
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

  function addProduct(p: ProductRow) {
    setItems([...items, {
      product_id: p.id, sat_key: p.sat_key, sat_unit: p.sat_unit, description: p.description,
      quantity: 1, unit_price: Number(p.unit_price), discount: 0, iva_rate: Number(p.iva_rate),
    }]);
    setOpen(false);
  }

  function addManual() {
    setItems([...items, { sat_key: "01010101", sat_unit: "E48", description: "", quantity: 1, unit_price: 0, discount: 0, iva_rate: 0.16 }]);
    setOpen(false);
  }

  function update(idx: number, patch: Partial<LineItem>) {
    setItems(items.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  function remove(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      {items.map((it, idx) => (
        <div key={idx} className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <input
              value={it.description}
              onChange={(e) => update(idx, { description: e.target.value })}
              placeholder="Descripción"
              className="flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
            />
            <button onClick={() => remove(idx)} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="size-4" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Mini label="Cant.">
              <input type="number" step="0.01" min="0" value={it.quantity} onChange={(e) => update(idx, { quantity: Number(e.target.value) })} className="ff-mini" />
            </Mini>
            <Mini label="Precio">
              <input type="number" step="0.01" min="0" value={it.unit_price} onChange={(e) => update(idx, { unit_price: Number(e.target.value) })} className="ff-mini" />
            </Mini>
            <Mini label="Desc.">
              <input type="number" step="0.01" min="0" value={it.discount} onChange={(e) => update(idx, { discount: Number(e.target.value) })} className="ff-mini" />
            </Mini>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Mini label="Clave SAT">
              <select value={it.sat_key} onChange={(e) => update(idx, { sat_key: e.target.value })} className="ff-mini">
                {COMMON_SAT_KEYS.map((k) => <option key={k.code} value={k.code}>{k.code}</option>)}
              </select>
            </Mini>
            <Mini label="Unidad">
              <select value={it.sat_unit} onChange={(e) => update(idx, { sat_unit: e.target.value })} className="ff-mini">
                {COMMON_SAT_UNITS.map((u) => <option key={u.code} value={u.code}>{u.code}</option>)}
              </select>
            </Mini>
            <Mini label="IVA">
              <select value={it.iva_rate} onChange={(e) => update(idx, { iva_rate: Number(e.target.value) })} className="ff-mini">
                <option value={0.16}>16%</option>
                <option value={0.08}>8%</option>
                <option value={0}>0%</option>
              </select>
            </Mini>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Importe</span>
            <span className="font-bold">{formatMXN(it.quantity * it.unit_price - it.discount)}</span>
          </div>
        </div>
      ))}

      {open ? (
        <div className="rounded-2xl border border-border bg-surface p-3">
          <p className="mb-2 px-1 text-xs font-semibold uppercase text-muted-foreground">Elige del catálogo</p>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {(products ?? []).map((p) => (
              <button key={p.id} onClick={() => addProduct(p)} className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left hover:bg-accent">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.description}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">SAT {p.sat_key}</p>
                </div>
                <span className="shrink-0 text-sm font-bold">{formatMXN(p.unit_price)}</span>
              </button>
            ))}
            {(products ?? []).length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">Tu catálogo está vacío.</p>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={addManual} className="rounded-xl border border-border bg-background py-2 text-xs font-semibold">Agregar manual</button>
            <button onClick={() => setOpen(false)} className="rounded-xl bg-muted py-2 text-xs font-semibold text-muted-foreground">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-surface py-3 text-sm font-semibold text-primary">
          <Plus className="size-4" /> Agregar concepto
        </button>
      )}

      <button
        onClick={onNext}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-semibold text-background transition active:scale-[0.98]"
      >
        Continuar <ArrowRight className="size-4" />
      </button>

      <style>{`.ff-mini{width:100%;border-radius:0.75rem;border:1px solid var(--input);background:var(--background);padding:0.5rem 0.625rem;font-size:0.8rem;outline:none;font-family:var(--font-mono)}.ff-mini:focus{border-color:var(--primary)}`}</style>
    </div>
  );
}

function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/* -------- Step 3: Review -------- */
function StepReview({
  client, items, totals, paymentMethod, paymentForm, cfdiUse,
  setPaymentMethod, setPaymentForm, setCfdiUse, onIssue, issuing,
}: {
  client: ClientRow; items: LineItem[]; totals: { subtotal: number; ivaTotal: number; total: number };
  paymentMethod: string; paymentForm: string; cfdiUse: string;
  setPaymentMethod: (v: string) => void; setPaymentForm: (v: string) => void; setCfdiUse: (v: string) => void;
  onIssue: () => void; issuing: boolean;
}) {
  // Validaciones inteligentes
  const warnings: string[] = [];
  if (!client.tax_regime) warnings.push("El cliente no tiene régimen fiscal asignado.");
  if (!client.postal_code) warnings.push("Falta código postal del receptor.");
  if (paymentMethod === "PPD" && paymentForm !== "99") warnings.push("Para pagos en parcialidades (PPD) la forma de pago suele ser 99.");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</p>
        <p className="mt-1 font-semibold">{client.legal_name}</p>
        <p className="font-mono text-xs text-muted-foreground">{client.rfc}</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Datos fiscales</p>
        <div className="space-y-2">
          <Mini label="Uso CFDI">
            <select value={cfdiUse} onChange={(e) => setCfdiUse(e.target.value)} className="ff-mini">
              {CFDI_USES.map((u) => <option key={u.code} value={u.code}>{u.code} — {u.name}</option>)}
            </select>
          </Mini>
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Método">
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="ff-mini">
                {PAYMENT_METHODS.map((m) => <option key={m.code} value={m.code}>{m.code}</option>)}
              </select>
            </Mini>
            <Mini label="Forma de pago">
              <select value={paymentForm} onChange={(e) => setPaymentForm(e.target.value)} className="ff-mini">
                {PAYMENT_FORMS.map((f) => <option key={f.code} value={f.code}>{f.code} — {f.name}</option>)}
              </select>
            </Mini>
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-warning-foreground">
            <AlertCircle className="size-4 text-warning" /> Revisa antes de timbrar
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {warnings.map((w) => <li key={w}>• {w}</li>)}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conceptos ({items.length})</p>
        <ul className="divide-y divide-border">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 truncate"><span className="font-mono text-[10px] text-muted-foreground">x{it.quantity}</span> {it.description || "—"}</span>
              <span className="font-bold">{formatMXN(it.quantity * it.unit_price - it.discount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
          <Row label="Subtotal" value={formatMXN(totals.subtotal)} />
          <Row label="IVA" value={formatMXN(totals.ivaTotal)} />
          <Row label="Total" value={formatMXN(totals.total)} bold />
        </div>
      </div>

      <button
        onClick={onIssue}
        disabled={issuing}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-semibold text-background transition active:scale-[0.98] disabled:opacity-60"
      >
        {issuing ? <Loader2 className="size-4 animate-spin" /> : <>Emitir factura <Check className="size-4" /></>}
      </button>
      <p className="text-center text-[10px] text-muted-foreground">
        Conexión con PAC en modo demo · Configura tu PAC en producción.
      </p>

      <style>{`.ff-mini{width:100%;border-radius:0.75rem;border:1px solid var(--input);background:var(--background);padding:0.5rem 0.625rem;font-size:0.8rem;outline:none}.ff-mini:focus{border-color:var(--primary)}`}</style>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "text-base font-bold" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className={bold ? "text-foreground" : ""}>{value}</span>
    </div>
  );
}

/* -------- Step 4: Success -------- */
function StepSuccess({ result }: { result: { id: string; series: string; folio: number; uuid: string; xmlUrl: string } }) {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-success/10 text-success">
        <FileCheck2 className="size-7" />
      </div>
      <h2 className="mt-5 text-2xl font-bold tracking-tight">¡Factura emitida!</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Folio <span className="font-mono font-semibold text-foreground">{result.series}-{String(result.folio).padStart(6, "0")}</span>
      </p>
      <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">UUID: {result.uuid}</p>

      <div className="mt-8 grid grid-cols-3 gap-2">
        <a href={result.xmlUrl} download={`${result.series}-${result.folio}.xml`} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface p-4 text-xs font-semibold">
          <Download className="size-5 text-primary" /> XML
        </a>
        <button className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface p-4 text-xs font-semibold">
          <Download className="size-5 text-primary" /> PDF
        </button>
        <button className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface p-4 text-xs font-semibold">
          <Share2 className="size-5 text-primary" /> Enviar
        </button>
      </div>

      <Link to="/dashboard" className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
        <Home className="size-4" /> Volver al inicio
      </Link>
    </div>
  );
}
