import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Plus, Star, Mail, Users, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsList,
});

async function loadClients() {
  const { data, error } = await supabase
    .from("clients")
    .select("id, legal_name, rfc, email, is_favorite, cfdi_use")
    .order("is_favorite", { ascending: false })
    .order("legal_name");
  if (error) throw error;
  return data ?? [];
}

function ClientsList() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["clients"], queryFn: loadClients });

  const filtered = (data ?? []).filter((c) => {
    if (!q) return true;
    const t = q.toLowerCase();
    return c.legal_name.toLowerCase().includes(t) || c.rfc.toLowerCase().includes(t);
  });

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Catálogo</p>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        </div>
        <Link
          to="/clients/new"
          className="grid size-11 place-items-center rounded-full bg-foreground text-background shadow-lift transition active:scale-95"
          aria-label="Nuevo cliente"
        >
          <Plus className="size-5" strokeWidth={2.4} />
        </Link>
      </header>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por RFC o nombre…"
          className="w-full rounded-2xl border border-input bg-surface py-3 pl-11 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring"
        />
      </div>

      <div className="mt-5">
        {isLoading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-surface" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q ? "Sin resultados" : "Aún no tienes clientes"}
            description={q ? "Intenta con otro nombre o RFC." : "Agrega a tus clientes para facturar más rápido."}
            action={!q && (
              <Link to="/clients/new" className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
                <Plus className="size-4" /> Agregar cliente
              </Link>
            )}
          />
        ) : (
          <ul className="divide-y divide-border rounded-3xl border border-border bg-surface">
            {filtered.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold uppercase text-primary">
                  {c.legal_name.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-semibold">{c.legal_name}</p>
                    {c.is_favorite && <Star className="size-3.5 fill-warning text-warning" />}
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground">{c.rfc}</p>
                </div>
                {c.email && (
                  <a href={`mailto:${c.email}`} className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Mail className="size-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
