import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Search, Plus, Trash2, Check, Loader2, FileCheck2, Download, Share2, Home, AlertCircle, Pencil, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatMXN } from "@/lib/format";
import {
  CFDI_USES,
  PAYMENT_FORMS,
  PAYMENT_METHODS,
  COMMON_SAT_KEYS,
  COMMON_SAT_UNITS,
  CURRENCIES,
  EXPORT_CODES,
  CFDI_TYPES,
  TAX_REGIMES,
  cfdiUsesForRegime,
} from "@/lib/sat-catalogs";
import {
  normalizeFiscalName,
  validateReceiverProfile,
  validatePayment,
  hasErrors,
  type FieldErrors,
  type ReceiverProfile,
} from "@/lib/fiscal";
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

  // Perfil receptor editable para ESTA factura (arranca desde el cliente).
  const [receiver, setReceiver] = useState<ReceiverProfile | null>(null);
  const [saveReceiverEdits, setSaveReceiverEdits] = useState(false);

  // Datos fiscales del comprobante
  const [cfdiType, setCfdiType] = useState("I");
  const [paymentMethod, setPaymentMethod] = useState("PUE");
  const [paymentForm, setPaymentForm] = useState("03");
  const [currency, setCurrency] = useState("MXN");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [exportCode, setExportCode] = useState("01");

  const [issuing, setIssuing] = useState(false);
  const [result, setResult] = useState<{ id: string; series: string; folio: number; uuid: string; xmlUrl: string } | null>(null);

  // Perfil emisor (para reglas de RFC genérico → CP del emisor)
  const { data: issuer } = useQuery({
    queryKey: ["company", "issuer"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("companies").select("*").eq("user_id", u.user.id).maybeSingle();
      return data;
    },
  });

  const totals = useMemo(() => {
    const subtotal = items.reduce((a, i) => a + (i.quantity * i.unit_price - i.discount), 0);
    const ivaTotal = items.reduce((a, i) => a + (i.quantity * i.unit_price - i.discount) * i.iva_rate, 0);
    return { subtotal, ivaTotal, total: subtotal + ivaTotal };
  }, [items]);

  const receiverErrors: FieldErrors = useMemo(() => {
    if (!receiver) return {};
    return validateReceiverProfile(receiver, issuer?.postal_code ?? null);
  }, [receiver, issuer]);

  const paymentError = validatePayment(paymentMethod, paymentForm);

  function pickClient(c: ClientRow) {
    setClient(c);
    setReceiver({
      rfc: c.rfc,
      legal_name: normalizeFiscalName(c.legal_name),
      tax_regime: c.tax_regime,
      postal_code: c.postal_code,
      cfdi_use: c.cfdi_use ?? "G03",
    });
    setSaveReceiverEdits(false);
    setStep(2);
  }

  async function onIssue() {
    if (!client || !receiver) return;
    if (items.length === 0) { toast.error("Agrega al menos un concepto"); return; }
    if (hasErrors(receiverErrors)) { toast.error("Revisa los datos fiscales del receptor"); return; }
    if (paymentError) { toast.error(paymentError); return; }
    if (currency !== "MXN" && (!exchangeRate || exchangeRate <= 0)) {
      toast.error("Captura el tipo de cambio para la moneda seleccionada");
      return;
    }

    setIssuing(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data: company } = await supabase.from("companies").select("*").eq("user_id", u.user!.id).maybeSingle();
      if (!company) {
        toast.error("Configura tu perfil del negocio antes de facturar.");
        navigate({ to: "/profile" });
        return;
      }
      if (!company.csd_cer_url || !company.csd_key_url || !company.csd_password_encrypted) {
        toast.error("Configura tu Certificado de Sello Digital (CSD) antes de timbrar.");
        return;
      }


      // Folio siguiente
      const { data: lastFolio } = await supabase
        .from("invoices").select("folio").eq("user_id", u.user!.id).eq("series", "A")
        .order("folio", { ascending: false }).limit(1).maybeSingle();
      const folio = (lastFolio?.folio ?? 0) + 1;

      const stamp = await pac.stamp({
        series: "A",
        folio,
        issuerRfc: company.rfc,
        receiverRfc: receiver.rfc,
        receiverName: receiver.legal_name,
        receiverTaxRegime: receiver.tax_regime ?? "",
        receiverCfdiUse: receiver.cfdi_use ?? "",
        receiverPostalCode: receiver.postal_code ?? "",
        paymentForm,
        paymentMethod,
        currency,
        items: items.map((i) => ({
          satKey: i.sat_key, satUnit: i.sat_unit, description: i.description,
          quantity: i.quantity, unitPrice: i.unit_price, discount: i.discount, ivaRate: i.iva_rate,
        })),
      });

      if (!stamp.ok) { toast.error(`Error PAC: ${stamp.message}`); return; }

      const { data: invoice, error } = await supabase.from("invoices").insert({
        user_id: u.user!.id,
        company_id: company.id,
        client_id: client.id,
        client_snapshot: {
          legal_name: receiver.legal_name,
          rfc: receiver.rfc,
          cfdi_use: receiver.cfdi_use,
          tax_regime: receiver.tax_regime,
          postal_code: receiver.postal_code,
        },
        series: "A",
        folio,
        uuid_fiscal: stamp.uuid,
        status: "issued",
        payment_method: paymentMethod,
        payment_form: paymentForm,
        cfdi_use: receiver.cfdi_use,
        currency,
        exchange_rate: currency === "MXN" ? 1 : exchangeRate,
        subtotal: totals.subtotal,
        iva_total: totals.ivaTotal,
        total: totals.total,
        xml_url: stamp.xmlUrl,
        issued_at: stamp.stampedAt,
        notes: `cfdi_type=${cfdiType};export=${exportCode}`,
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

      // Guardar cambios en el perfil del cliente si el usuario lo pidió
      if (saveReceiverEdits) {
        await supabase.from("clients").update({
          legal_name: receiver.legal_name,
          tax_regime: receiver.tax_regime,
          postal_code: receiver.postal_code,
          cfdi_use: receiver.cfdi_use,
        }).eq("id", client.id);
        qc.invalidateQueries({ queryKey: ["clients"] });
      }

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
        {step === 1 && <StepClient onPick={pickClient} />}
        {step === 2 && (
          <StepItems
            items={items}
            setItems={setItems}
            onNext={() => items.length > 0 ? setStep(3) : toast.error("Agrega al menos un concepto")}
          />
        )}
        {step === 3 && client && receiver && (
          <StepReview
            issuer={issuer}
            client={client}
            receiver={receiver}
            setReceiver={setReceiver}
            receiverErrors={receiverErrors}
            saveReceiverEdits={saveReceiverEdits}
            setSaveReceiverEdits={setSaveReceiverEdits}
            items={items}
            totals={totals}
            cfdiType={cfdiType}
            setCfdiType={setCfdiType}
            paymentMethod={paymentMethod}
            paymentForm={paymentForm}
            setPaymentMethod={setPaymentMethod}
            setPaymentForm={setPaymentForm}
            paymentError={paymentError}
            currency={currency}
            setCurrency={setCurrency}
            exchangeRate={exchangeRate}
            setExchangeRate={setExchangeRate}
            exportCode={exportCode}
            setExportCode={setExportCode}
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

function Mini({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {error && <span className="mt-1 block text-[10px] font-medium text-destructive">{error}</span>}
    </label>
  );
}

/* -------- Step 3: Review -------- */
type StepReviewProps = {
  issuer: { rfc?: string; legal_name?: string; postal_code?: string | null; tax_regime?: string | null } | null | undefined;
  client: ClientRow;
  receiver: ReceiverProfile;
  setReceiver: (r: ReceiverProfile) => void;
  receiverErrors: FieldErrors;
  saveReceiverEdits: boolean;
  setSaveReceiverEdits: (v: boolean) => void;
  items: LineItem[];
  totals: { subtotal: number; ivaTotal: number; total: number };
  cfdiType: string; setCfdiType: (v: string) => void;
  paymentMethod: string; paymentForm: string;
  setPaymentMethod: (v: string) => void; setPaymentForm: (v: string) => void;
  paymentError: string | null;
  currency: string; setCurrency: (v: string) => void;
  exchangeRate: number; setExchangeRate: (v: number) => void;
  exportCode: string; setExportCode: (v: string) => void;
  onIssue: () => void; issuing: boolean;
};

function StepReview(props: StepReviewProps) {
  const {
    issuer, client, receiver, setReceiver, receiverErrors,
    saveReceiverEdits, setSaveReceiverEdits,
    items, totals,
    cfdiType, setCfdiType,
    paymentMethod, paymentForm, setPaymentMethod, setPaymentForm, paymentError,
    currency, setCurrency, exchangeRate, setExchangeRate,
    exportCode, setExportCode,
    onIssue, issuing,
  } = props;

  const [editReceiver, setEditReceiver] = useState(false);
  const receiverBlocking = hasErrors(receiverErrors);
  const allowedUses = useMemo(() => cfdiUsesForRegime(receiver.tax_regime), [receiver.tax_regime]);
  const isEditedFromClient =
    receiver.legal_name !== normalizeFiscalName(client.legal_name) ||
    receiver.tax_regime !== client.tax_regime ||
    receiver.postal_code !== client.postal_code ||
    receiver.cfdi_use !== (client.cfdi_use ?? receiver.cfdi_use);

  // Autoabre edición si el perfil viene incompleto
  useEffect(() => {
    if (receiverBlocking) setEditReceiver(true);
  }, [receiverBlocking]);

  function upd<K extends keyof ReceiverProfile>(k: K, v: ReceiverProfile[K]) {
    const next = { ...receiver, [k]: v };
    // Si cambia el régimen y el uso ya no aplica, resetea el uso.
    if (k === "tax_regime") {
      const allowed = cfdiUsesForRegime(v as string).map((x) => x.code);
      if (next.cfdi_use && !allowed.includes(next.cfdi_use)) next.cfdi_use = null;
    }
    setReceiver(next);
  }

  return (
    <div className="space-y-4">
      {/* Emisor */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Emisor</p>
        <p className="mt-1 truncate font-semibold">{issuer?.legal_name ?? "Configura tu perfil"}</p>
        <p className="font-mono text-xs text-muted-foreground">
          {issuer?.rfc ?? "—"} · CP {issuer?.postal_code ?? "—"} · Régimen {issuer?.tax_regime ?? "—"}
        </p>
      </div>

      {/* Receptor */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Receptor</p>
            <p className="mt-1 truncate font-semibold">{receiver.legal_name || "—"}</p>
            <p className="font-mono text-xs text-muted-foreground">{receiver.rfc}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditReceiver((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-3" /> {editReceiver ? "Ocultar" : "Editar"}
          </button>
        </div>

        {!editReceiver && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <MiniStat label="Régimen" value={receiver.tax_regime ?? "—"} />
            <MiniStat label="CP" value={receiver.postal_code ?? "—"} />
            <MiniStat label="Uso CFDI" value={receiver.cfdi_use ?? "—"} />
          </div>
        )}

        {editReceiver && (
          <div className="mt-3 space-y-2.5">
            <Mini label="Nombre / razón social (como en la constancia)" error={receiverErrors.legal_name}>
              <input
                value={receiver.legal_name}
                onChange={(e) => upd("legal_name", e.target.value)}
                onBlur={(e) => upd("legal_name", normalizeFiscalName(e.target.value))}
                className="ff-mini"
                placeholder="MI EMPRESA EJEMPLO"
              />
            </Mini>
            <div className="grid grid-cols-2 gap-2">
              <Mini label="Régimen fiscal" error={receiverErrors.tax_regime}>
                <select value={receiver.tax_regime ?? ""} onChange={(e) => upd("tax_regime", e.target.value || null)} className="ff-mini">
                  <option value="">Selecciona…</option>
                  {TAX_REGIMES.map((r) => <option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}
                </select>
              </Mini>
              <Mini label="Código postal" error={receiverErrors.postal_code}>
                <input
                  value={receiver.postal_code ?? ""}
                  onChange={(e) => upd("postal_code", e.target.value.replace(/\D/g, "").slice(0, 5))}
                  inputMode="numeric"
                  maxLength={5}
                  className="ff-mini font-mono"
                  placeholder="00000"
                />
              </Mini>
            </div>
            <Mini label="Uso CFDI (filtrado por régimen)" error={receiverErrors.cfdi_use}>
              <select value={receiver.cfdi_use ?? ""} onChange={(e) => upd("cfdi_use", e.target.value || null)} className="ff-mini">
                <option value="">Selecciona…</option>
                {(allowedUses.length ? allowedUses : CFDI_USES).map((u) => (
                  <option key={u.code} value={u.code}>{u.code} — {u.name}</option>
                ))}
              </select>
            </Mini>

            {isEditedFromClient && (
              <label className="mt-1 flex items-center gap-2 rounded-xl bg-primary-soft/60 px-3 py-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={saveReceiverEdits}
                  onChange={(e) => setSaveReceiverEdits(e.target.checked)}
                  className="size-4 accent-[var(--primary)]"
                />
                <span>
                  <Save className="mr-1 inline size-3 -mt-0.5" />
                  Guardar estos cambios en el perfil del cliente
                </span>
              </label>
            )}
          </div>
        )}
      </div>

      {/* Datos del comprobante */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Datos del comprobante</p>
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Tipo de comprobante">
              <select value={cfdiType} onChange={(e) => setCfdiType(e.target.value)} className="ff-mini">
                {CFDI_TYPES.map((t) => <option key={t.code} value={t.code}>{t.code} — {t.name}</option>)}
              </select>
            </Mini>
            <Mini label="Exportación">
              <select value={exportCode} onChange={(e) => setExportCode(e.target.value)} className="ff-mini">
                {EXPORT_CODES.map((e2) => <option key={e2.code} value={e2.code}>{e2.code} — {e2.name}</option>)}
              </select>
            </Mini>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Moneda">
              <select value={currency} onChange={(e) => { setCurrency(e.target.value); if (e.target.value === "MXN") setExchangeRate(1); }} className="ff-mini">
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </Mini>
            {currency !== "MXN" && (
              <Mini label={`T. cambio ${currency}→MXN`}>
                <input type="number" min="0" step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value))} className="ff-mini font-mono" />
              </Mini>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Método" error={paymentError && paymentMethod === "PPD" ? paymentError : undefined}>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="ff-mini">
                {PAYMENT_METHODS.map((m) => <option key={m.code} value={m.code}>{m.code} — {m.name}</option>)}
              </select>
            </Mini>
            <Mini label="Forma de pago" error={paymentError && paymentMethod !== "PPD" ? paymentError : undefined}>
              <select value={paymentForm} onChange={(e) => setPaymentForm(e.target.value)} className="ff-mini">
                {PAYMENT_FORMS.map((f) => <option key={f.code} value={f.code}>{f.code} — {f.name}</option>)}
              </select>
            </Mini>
          </div>
        </div>
      </div>

      {/* Conceptos + totales */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conceptos ({items.length})</p>
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

      {(receiverBlocking || paymentError) && (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>Corrige los campos marcados en rojo antes de emitir.</span>
        </div>
      )}

      <button
        onClick={onIssue}
        disabled={issuing || receiverBlocking || !!paymentError}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-semibold text-background transition active:scale-[0.98] disabled:opacity-50"
      >
        {issuing ? <Loader2 className="size-4 animate-spin" /> : <>Emitir factura <Check className="size-4" /></>}
      </button>
      <p className="text-center text-[10px] text-muted-foreground">
        Conexión con PAC en modo demo · Configura tu PAC en producción.
      </p>

      <style>{`.ff-mini{width:100%;border-radius:0.75rem;border:1px solid var(--input);background:var(--background);padding:0.5rem 0.625rem;font-size:0.8rem;outline:none}.ff-mini:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--ring)}`}</style>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-2.5 py-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono text-xs font-semibold">{value}</p>
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
