import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Bell, TrendingUp, Users as UsersIcon, FileText, LogOut, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatMXN, formatDateMX } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

interface DashboardData {
  todayCount: number;
  monthTotal: number;
  clientsCount: number;
  recent: Array<{
    id: string;
    series: string;
    folio: number;
    total: number;
    status: string;
    created_at: string;
    client_snapshot: { legal_name?: string } | null;
  }>;
  businessName: string;
}

async function loadDashboard(): Promise<DashboardData> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  const email = userData.user?.email ?? "";

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [companyRes, todayRes, monthRes, clientsRes, recentRes] = await Promise.all([
    supabase.from("companies").select("trade_name, legal_name").eq("user_id", userId!).limit(1).maybeSingle(),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "issued").gte("created_at", startOfDay),
    supabase.from("invoices").select("total").eq("status", "issued").gte("created_at", startOfMonth),
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("invoices").select("id, series, folio, total, status, created_at, client_snapshot").order("created_at", { ascending: false }).limit(5),
  ]);

  const monthTotal = (monthRes.data ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0);

  return {
    todayCount: todayRes.count ?? 0,
    monthTotal,
    clientsCount: clientsRes.count ?? 0,
    recent: (recentRes.data as DashboardData["recent"]) ?? [],
    businessName: companyRes.data?.trade_name || companyRes.data?.legal_name || email.split("@")[0] || "Mi negocio",
  };
}

function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: loadDashboard });

  async function onSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initials = (data?.businessName ?? "FF").slice(0, 2).toUpperCase();

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full bg-primary-soft text-sm font-bold uppercase text-primary">
            {initials}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Factura Fácil</p>
            <h1 className="text-base font-semibold leading-tight">{data?.businessName ?? "..."}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="relative grid size-10 place-items-center rounded-full border border-border bg-surface transition active:scale-95"
            aria-label="Notificaciones"
          >
            <Bell className="size-[18px]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="grid size-10 place-items-center rounded-full border border-border bg-surface transition active:scale-95"
            aria-label="Cerrar sesión"
          >
            <LogOut className="size-[18px]" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 animate-reveal">
        <div className="col-span-2 rounded-3xl border border-border bg-surface p-5 shadow-soft">
          <p className="text-sm text-muted-foreground">Facturación del mes</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">
            {isLoading ? "—" : formatMXN(data?.monthTotal ?? 0)}
            <span className="ml-2 align-middle text-sm font-medium text-muted-foreground">MXN</span>
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendingUp className="size-3.5" />
            <span>Calculado en tiempo real</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <FileText className="size-3.5" /> Facturas hoy
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight">{isLoading ? "—" : data?.todayCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <UsersIcon className="size-3.5" /> Clientes
          </div>
          <p className="mt-1 text-2xl font-bold tracking-tight">{isLoading ? "—" : data?.clientsCount}</p>
        </div>
      </section>

      <Link
        to="/invoices/new"
        className="mt-6 flex w-full animate-reveal items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-semibold text-background shadow-lift transition active:scale-[0.98]"
        style={{ animationDelay: "100ms" }}
      >
        <Plus className="size-5" strokeWidth={2.4} />
        Nueva factura
      </Link>

      <section className="mt-10 animate-reveal" style={{ animationDelay: "200ms" }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Facturas recientes</h2>
          <Link to="/history" className="text-sm font-semibold text-primary">Ver todas</Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl border border-border bg-surface" />
            ))}
          </div>
        ) : data && data.recent.length > 0 ? (
          <ul className="divide-y divide-border rounded-3xl border border-border bg-surface">
            {data.recent.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{inv.client_snapshot?.legal_name ?? "Cliente"}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-tight text-muted-foreground">
                    {inv.series}-{String(inv.folio).padStart(6, "0")} · {formatDateMX(inv.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatMXN(inv.total)}</p>
                  <StatusChip status={inv.status} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-surface px-6 py-12 text-center">
            <p className="font-semibold">Aún no has emitido facturas</p>
            <p className="mt-1 text-sm text-muted-foreground">Crea tu primera factura en menos de 60 segundos.</p>
            <Link
              to="/invoices/new"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              Nueva factura <ChevronRight className="size-4" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    issued: { label: "Vigente", cls: "bg-primary-soft text-primary" },
    draft: { label: "Borrador", cls: "bg-muted text-muted-foreground" },
    cancelled: { label: "Cancelada", cls: "bg-destructive/10 text-destructive" },
    error: { label: "Error", cls: "bg-destructive/10 text-destructive" },
  };
  const v = map[status] ?? map.draft;
  return (
    <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${v.cls}`}>
      <span className="size-1.5 rounded-full bg-current" /> {v.label}
    </span>
  );
}
