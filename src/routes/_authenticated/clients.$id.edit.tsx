import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { validateRFC } from "@/lib/format";
import { TAX_REGIMES, CFDI_USES } from "@/lib/sat-catalogs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/clients/$id/edit")({
  component: EditClient,
});

type ClientRow = {
  id: string;
  rfc: string;
  legal_name: string;
  tax_regime: string | null;
  postal_code: string | null;
  cfdi_use: string | null;
  email: string | null;
  phone: string | null;
  is_favorite: boolean;
  notes: string | null;
};

async function loadClient(id: string): Promise<ClientRow> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, rfc, legal_name, tax_regime, postal_code, cfdi_use, email, phone, is_favorite, notes")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Cliente no encontrado");
  return data as ClientRow;
}

function EditClient() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["clients", id], queryFn: () => loadClient(id) });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<ClientRow | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  function set<K extends keyof ClientRow>(k: K, v: ClientRow[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const rfcCheck = validateRFC(form.rfc);
    if (!rfcCheck.valid) { toast.error(rfcCheck.reason!); return; }
    if (!form.legal_name.trim()) { toast.error("La razón social es requerida"); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          rfc: form.rfc.toUpperCase().trim(),
          legal_name: form.legal_name.trim(),
          tax_regime: form.tax_regime,
          postal_code: form.postal_code?.toString().trim() || null,
          cfdi_use: form.cfdi_use,
          email: form.email?.trim() || null,
          phone: form.phone?.trim() || null,
          is_favorite: form.is_favorite,
          notes: form.notes?.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Cliente actualizado");
      qc.invalidateQueries({ queryKey: ["clients"] });
      navigate({ to: "/clients" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos guardar los cambios");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    setDeleting(true);
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      toast.success("Cliente eliminado");
      qc.invalidateQueries({ queryKey: ["clients"] });
      navigate({ to: "/clients" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No pudimos eliminar";
      if (msg.toLowerCase().includes("foreign") || msg.toLowerCase().includes("violates")) {
        toast.error("Este cliente tiene facturas asociadas y no se puede eliminar");
      } else {
        toast.error(msg);
      }
      setDeleting(false);
    }
  }

  if (isLoading || !form) {
    return (
      <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
        <div className="h-10 w-32 animate-pulse rounded-full bg-muted" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
        <p className="text-sm text-destructive">{(error as Error).message}</p>
        <Link to="/clients" className="mt-4 inline-block text-sm underline">Volver</Link>
      </div>
    );
  }

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/clients" className="grid size-10 place-items-center rounded-full border border-border bg-surface">
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="truncate text-xl font-bold tracking-tight">Editar cliente</h1>
        </div>
        <button
          type="button"
          onClick={() => set("is_favorite", !form.is_favorite)}
          className="grid size-10 place-items-center rounded-full border border-border bg-surface"
          aria-label="Favorito"
        >
          <Star className={`size-4 ${form.is_favorite ? "fill-warning text-warning" : "text-muted-foreground"}`} />
        </button>
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
          <input value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} className="ff-input" required />
        </Field>
        <Field label="Régimen fiscal">
          <select value={form.tax_regime ?? ""} onChange={(e) => set("tax_regime", e.target.value)} className="ff-input">
            {TAX_REGIMES.map((r) => <option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Código postal">
            <input value={form.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value)} maxLength={5} className="ff-input font-mono" />
          </Field>
          <Field label="Uso CFDI">
            <select value={form.cfdi_use ?? ""} onChange={(e) => set("cfdi_use", e.target.value)} className="ff-input">
              {CFDI_USES.map((u) => <option key={u.code} value={u.code}>{u.code} — {u.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Correo">
          <input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="cliente@correo.com" className="ff-input" />
        </Field>
        <Field label="Teléfono">
          <input type="tel" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="55 0000 0000" className="ff-input" />
        </Field>

        <button
          type="submit"
          disabled={saving}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-semibold text-background transition active:scale-[0.98] disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Guardar cambios"}
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={deleting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 py-3.5 text-sm font-semibold text-destructive transition active:scale-[0.98] disabled:opacity-60"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <><Trash2 className="size-4" /> Eliminar cliente</>}
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar este cliente?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Si el cliente tiene facturas emitidas, no podrá eliminarse.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
