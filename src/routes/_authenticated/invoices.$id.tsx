import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Copy, Download, Share2, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getEdgeFunctionErrorMessage } from "@/lib/edge-function-errors";
import { formatMXN, formatDateMX } from "@/lib/format";
import { openInvoiceDocument, shareInvoiceOnWhatsApp } from "@/lib/invoice-documents";
import { StatusChip } from "./dashboard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/invoices/$id")({
  component: InvoiceDetail,
});

const CANCEL_REASONS = [
  { code: "01", label: "01 — Comprobante emitido con errores con relación" },
  { code: "02", label: "02 — Comprobante emitido con errores sin relación" },
  { code: "03", label: "03 — No se llevó a cabo la operación" },
  { code: "04", label: "04 — Operación nominativa relacionada en una factura global" },
];

async function loadInvoice(id: string) {
  const [invRes, itemsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, series, folio, total, subtotal, iva_total, status, created_at, issued_at, uuid_fiscal, client_snapshot, xml_url, pdf_url, payment_method, payment_form, cfdi_use, currency, cancellation_reason, cancellation_status, cancellation_requested_at, cancellation_replacement_uuid, cancelled_at, client_id, clients(phone)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("invoice_items")
      .select(
        "id, description, quantity, unit_price, discount, iva_rate, iva_amount, amount, sat_key, sat_unit",
      )
      .eq("invoice_id", id)
      .order("position"),
  ]);
  if (invRes.error) throw invRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (!invRes.data) throw new Error("Factura no encontrada");
  return { invoice: invRes.data, items: itemsRes.data ?? [] };
}

function InvoiceDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => loadInvoice(id),
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState(CANCEL_REASONS[0].code);
  const [replacementUuid, setReplacementUuid] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  const folioFmt = data
    ? `${data.invoice.series}-${String(data.invoice.folio).padStart(6, "0")}`
    : "";

  async function sendWhatsApp() {
    if (!data?.invoice.pdf_url) return;
    setSendingWhatsApp(true);
    try {
      await shareInvoiceOnWhatsApp(
        data.invoice.pdf_url,
        `Factura ${folioFmt} por ${formatMXN(data.invoice.total)}`,
        data.invoice.clients?.phone,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos preparar el envío");
    } finally {
      setSendingWhatsApp(false);
    }
  }

  async function copyUuid() {
    if (!data?.invoice.uuid_fiscal) return;
    try {
      await navigator.clipboard.writeText(data.invoice.uuid_fiscal);
      toast.success("UUID copiado");
    } catch {
      toast.error("No pudimos copiar");
    }
  }

  async function confirmCancel() {
    if (!data) return;
    if (reason === "01" && !replacementUuid.trim()) {
      toast.error("El motivo 01 requiere el UUID del CFDI sustituto");
      return;
    }
    setCancelling(true);
    try {
      const { data: response, error } = await supabase.functions.invoke("facturama-cancel-cfdi", {
        body: {
          invoice_id: data.invoice.id,
          motive: reason,
          ...(reason === "01" ? { uuid_replacement: replacementUuid.trim() } : {}),
        },
      });
      if (error) {
        throw new Error(
          await getEdgeFunctionErrorMessage(error, "No fue posible cancelar el CFDI."),
        );
      }
      if (!response?.ok) {
        throw new Error(response?.reason ?? "No fue posible cancelar el CFDI.");
      }
      toast.success(
        response.cancelled
          ? "Factura cancelada ante el PAC"
          : "Solicitud de cancelación enviada; está pendiente de aceptación",
      );
      setConfirmOpen(false);
      setReplacementUuid("");
      qc.invalidateQueries({ queryKey: ["invoices", "history"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos cancelar");
    } finally {
      setCancelling(false);
    }
  }

  if (isLoading) {
    return (
      <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-surface" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <p className="font-semibold">No pudimos cargar la factura</p>
          <button
            onClick={() => navigate({ to: "/history" })}
            className="mt-4 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background"
          >
            Volver a Facturas
          </button>
        </div>
      </div>
    );
  }

  const inv = data.invoice;
  const snap = (inv.client_snapshot as { legal_name?: string; rfc?: string } | null) ?? {};
  const isIssued = inv.status === "issued";
  const isCancelled = inv.status === "cancelled";
  const cancellationPending = inv.cancellation_status === "pending";

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-10">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/history" })}
          className="grid size-9 place-items-center rounded-full border border-border bg-surface"
          aria-label="Volver"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Detalle de factura
          </p>
          <h1 className="font-mono text-lg font-bold tracking-tight">{folioFmt}</h1>
        </div>
      </header>

      <section className="mt-5 rounded-2xl border border-border bg-surface px-5 py-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Estado
        </h2>
        <div className="mt-2 flex items-center gap-2">
          <StatusChip status={inv.status} />
        </div>
        {isCancelled && inv.cancellation_reason && (
          <p className="mt-2 text-xs text-destructive">Motivo: {inv.cancellation_reason}</p>
        )}
        {cancellationPending && (
          <p className="mt-2 text-xs text-amber-700">
            Solicitud de cancelación enviada al PAC; pendiente de aceptación.
          </p>
        )}
        {inv.uuid_fiscal && (
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <p className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase text-muted-foreground">
              {inv.uuid_fiscal}
            </p>
            <button
              onClick={copyUuid}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold"
            >
              <Copy className="size-3" /> Copiar
            </button>
          </div>
        )}
      </section>

      <section className="mt-3 rounded-2xl border border-border bg-surface px-5 py-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Receptor
        </h2>
        <p className="mt-2 font-semibold">{snap.legal_name ?? "—"}</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{snap.rfc ?? "—"}</p>
      </section>

      <section className="mt-3 rounded-2xl border border-border bg-surface px-5 py-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Datos fiscales
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Uso CFDI</dt>
            <dd className="font-medium">{inv.cfdi_use ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Moneda</dt>
            <dd className="font-medium">{inv.currency ?? "MXN"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Método de pago</dt>
            <dd className="font-medium">{inv.payment_method ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Forma de pago</dt>
            <dd className="font-medium">{inv.payment_form ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">Fecha de emisión</dt>
            <dd className="font-medium">
              {inv.issued_at ? formatDateMX(inv.issued_at) : formatDateMX(inv.created_at)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-3 rounded-2xl border border-border bg-surface px-5 py-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Conceptos
        </h2>
        {data.items.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Sin conceptos.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {data.items.map((it) => (
              <li key={it.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{it.description}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {Number(it.quantity)} × {formatMXN(it.unit_price)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatMXN(it.amount)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatMXN(inv.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>IVA</span>
            <span>{formatMXN(inv.iva_total)}</span>
          </div>
          <div className="flex justify-between pt-1 text-base font-bold">
            <span>Total</span>
            <span>{formatMXN(inv.total)}</span>
          </div>
        </div>
      </section>

      {isIssued && (
        <section className="mt-5 space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Acciones
          </h2>
          <div className="flex flex-wrap gap-2">
            {inv.xml_url && (
              <button
                type="button"
                onClick={() =>
                  openInvoiceDocument(inv.xml_url!).catch((error) => toast.error(error.message))
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold"
              >
                <Download className="size-3.5" /> XML
              </button>
            )}
            {inv.pdf_url && (
              <button
                type="button"
                onClick={() =>
                  openInvoiceDocument(inv.pdf_url!).catch((error) => toast.error(error.message))
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold"
              >
                <Download className="size-3.5" /> PDF
              </button>
            )}
            {inv.pdf_url && (
              <button
                type="button"
                onClick={sendWhatsApp}
                disabled={sendingWhatsApp}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {sendingWhatsApp ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Share2 className="size-3.5" />
                )}{" "}
                WhatsApp
              </button>
            )}
            <button
              onClick={() => setConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
            >
              <Ban className="size-3.5" /> Cancelar factura
            </button>
          </div>
        </section>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta factura?</AlertDialogTitle>
            <AlertDialogDescription className="hidden">
              Esta acción no se puede deshacer. La factura quedará marcada como cancelada. En
              producción se enviará la solicitud al SAT.
            </AlertDialogDescription>
            <p className="text-sm text-muted-foreground">
              La solicitud se enviará a Facturama y al PAC. La factura sólo se marcará como
              cancelada si el PAC confirma la cancelación.
            </p>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">
              Motivo de cancelación
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring"
            >
              {CANCEL_REASONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
            {reason === "01" && (
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  UUID del CFDI sustituto
                </label>
                <input
                  value={replacementUuid}
                  onChange={(event) => setReplacementUuid(event.target.value)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring"
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Mantener factura</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmCancel();
              }}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? <Loader2 className="size-4 animate-spin" /> : "Sí, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
