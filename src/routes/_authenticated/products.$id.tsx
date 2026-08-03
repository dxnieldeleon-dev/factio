import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, MoreVertical, Pencil, Trash2, Folder, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatMXN, formatDateMX } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export const Route = createFileRoute("/_authenticated/products/$id")({
  component: ProductDetail,
});

type ProductDetailRow = {
  id: string;
  description: string;
  sat_key: string;
  sat_unit: string;
  unit_price: number;
  iva_rate: number;
  tax_object: string;
  isr_retencion_rate: number | null;
  iva_retencion_rate: number | null;
  internal_code: string | null;
  category: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

async function loadProduct(id: string): Promise<ProductDetailRow> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, description, sat_key, sat_unit, unit_price, iva_rate, tax_object, isr_retencion_rate, iva_retencion_rate, internal_code, category, image_url, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No encontramos este producto o servicio");
  return data;
}

function ProductDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", id],
    queryFn: () => loadProduct(id),
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      toast.success("Eliminado de tu catálogo");
      qc.invalidateQueries({ queryKey: ["products"] });
      navigate({ to: "/products" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos eliminarlo");
      setDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
        <div className="h-10 w-24 animate-pulse rounded-full bg-muted" />
        <div className="mt-5 h-64 animate-pulse rounded-3xl bg-muted" />
        <div className="mt-4 h-24 animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-6">
        <p className="text-sm text-destructive">No encontramos este producto o servicio.</p>
        <Link to="/products" className="mt-4 inline-block text-sm underline">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-24">
      <header className="flex items-center justify-between">
        <Link
          to="/products"
          className="grid size-10 place-items-center rounded-full border border-border bg-surface"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="grid size-10 place-items-center rounded-full border border-border bg-surface"
              aria-label="Más opciones"
            >
              <MoreVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => navigate({ to: "/products/$id/edit", params: { id } })}
            >
              <Pencil className="mr-2 size-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="mr-2 size-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="mt-5 aspect-square w-full overflow-hidden rounded-3xl border border-border bg-surface">
        {data.image_url ? (
          <img src={data.image_url} alt={data.description} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center bg-muted">
            <Package className="size-16 text-muted-foreground/50" strokeWidth={1.2} />
          </div>
        )}
      </div>

      <h1 className="mt-5 text-2xl font-bold tracking-tight">{data.description}</h1>
      {data.category && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Folder className="size-3.5" /> {data.category}
        </p>
      )}

      <div className="mt-4 rounded-3xl border border-border bg-surface p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Precio
        </p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-primary">
          {formatMXN(data.unit_price)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {data.tax_object === "01"
            ? "No objeto de impuesto"
            : `IVA ${Math.round(data.iva_rate * 100)}% incluido al facturar`}
        </p>
      </div>

      <div className="mt-3 rounded-3xl border border-border bg-surface p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Datos fiscales
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Clave SAT</dt>
            <dd className="font-mono font-medium">{data.sat_key}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Unidad SAT</dt>
            <dd className="font-mono font-medium">{data.sat_unit}</dd>
          </div>
          {data.internal_code && (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Código interno</dt>
              <dd className="font-mono font-medium">{data.internal_code}</dd>
            </div>
          )}
          {(data.isr_retencion_rate !== null || data.iva_retencion_rate !== null) && (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Retención fija (persona moral)</dt>
              <dd className="font-medium">
                ISR {Math.round((data.isr_retencion_rate ?? 0) * 10000) / 100}% · IVA{" "}
                {Math.round((data.iva_retencion_rate ?? 0) * 10000) / 100}%
              </dd>
            </div>
          )}
        </dl>
      </div>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        Creado {formatDateMX(data.created_at)} · Actualizado {formatDateMX(data.updated_at)}
      </p>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar de tu catálogo?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
