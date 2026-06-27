import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Plus, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/empty-state";
import { formatMXN } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/products")({
  component: ProductsList,
});

async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, description, sat_key, sat_unit, unit_price, internal_code, category")
    .eq("is_active", true)
    .order("description");
  if (error) throw error;
  return data ?? [];
}

function ProductsList() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["products"], queryFn: loadProducts });
  const filtered = (data ?? []).filter((p) => {
    if (!q) return true;
    const t = q.toLowerCase();
    return p.description.toLowerCase().includes(t) || p.sat_key.toLowerCase().includes(t) || (p.internal_code ?? "").toLowerCase().includes(t);
  });

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Catálogo</p>
          <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
        </div>
        <Link to="/products/new" className="grid size-11 place-items-center rounded-full bg-foreground text-background shadow-lift transition active:scale-95">
          <Plus className="size-5" strokeWidth={2.4} />
        </Link>
      </header>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por descripción, clave SAT, código…"
          className="w-full rounded-2xl border border-input bg-surface py-3 pl-11 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-ring"
        />
      </div>

      <div className="mt-5">
        {isLoading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-surface" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={q ? "Sin resultados" : "Aún no tienes productos"}
            description={q ? "Intenta con otra búsqueda." : "Agrega tus productos o servicios para facturar más rápido."}
            action={!q && (
              <Link to="/products/new" className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
                <Plus className="size-4" /> Agregar producto
              </Link>
            )}
          />
        ) : (
          <ul className="divide-y divide-border rounded-3xl border border-border bg-surface">
            {filtered.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.description}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                    SAT {p.sat_key} · {p.sat_unit}{p.internal_code ? ` · ${p.internal_code}` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-bold">{formatMXN(p.unit_price)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
