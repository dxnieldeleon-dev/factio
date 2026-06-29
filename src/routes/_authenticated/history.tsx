import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, FileText, Download, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatMXN, formatDateMX } from "@/lib/format";
import { StatusChip } from "./dashboard";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/history")({
  component: History,
});

async function loadInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, series, folio, total, status, created_at, uuid_fiscal, client_snapshot, xml_url, pdf_url")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

type StatusFilter = "all" | "issued" | "cancelled";

function History() {
  const { data, isLoading } = useQuery({ queryKey: ["invoices", "history"], queryFn: loadInvoices });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = (data ?? []).filter((i) => {
    if (status !== "all" && i.status !== status) return false;
    if (!q) return true;
    const t = q.toLowerCase();
    const snap = (i.client_snapshot as { legal_name?: string; rfc?: string } | null) ?? {};
    return (snap.legal_name ?? "").toLowerCase().includes(t)
      || (snap.rfc ?? "").toLowerCase().includes(t)
      || `${i.series}-${i.folio}`.toLowerCase().includes(t)
      || (i.uuid_fiscal ?? "").toLowerCase().includes(t);
  });

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Facturas</p>
        <h1 className="text-2xl font-bold tracking-tight">Facturas</h1>
      </header>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cliente, RFC, folio o UUID…"
          className="w-full rounded-2xl border border-input bg-surface py-3 pl-11 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring"
        />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {([
          ["all", "Todas"],
          ["issued", "Vigentes"],
          ["cancelled", "Canceladas"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatus(key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              status === key ? "bg-foreground text-background" : "border border-border bg-surface text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {isLoading ? (
          <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-surface" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="Sin facturas" description="Cuando emitas facturas aparecerán aquí." />
        ) : (
          <ul className="space-y-2">
            {filtered.map((inv) => {
              const snap = (inv.client_snapshot as { legal_name?: string; rfc?: string } | null) ?? {};
              return (
                <li key={inv.id} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{snap.legal_name ?? "Cliente"}</p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                        {inv.series}-{String(inv.folio).padStart(6, "0")} · {formatDateMX(inv.created_at)}
                        {snap.rfc ? ` · ${snap.rfc}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatMXN(inv.total)}</p>
                      <StatusChip status={inv.status} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    {inv.pdf_url && (
                      <a
                        href={inv.pdf_url}
                        download={`${inv.series}-${inv.folio}.pdf`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold"
                      >
                        <Download className="size-3" /> PDF
                      </a>
                    )}
                    {inv.xml_url && (
                      <a
                        href={inv.xml_url}
                        download={`${inv.series}-${inv.folio}.xml`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold"
                      >
                        <Download className="size-3" /> XML
                      </a>
                    )}
                    {(inv.pdf_url || inv.xml_url) && (
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `Factura ${inv.series}-${String(inv.folio).padStart(6, "0")} por ${formatMXN(inv.total)}${inv.pdf_url ? `\n${inv.pdf_url}` : ""}`,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1 text-[11px] font-semibold text-white"
                      >
                        <Share2 className="size-3" /> WhatsApp
                      </a>
                    )}
                  </div>

                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
