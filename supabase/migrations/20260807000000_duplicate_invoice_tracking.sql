-- Botón "Duplicar factura": trazabilidad de qué borrador se creó a partir
-- de qué factura origen. No se usa para lógica de negocio (folio, totales,
-- retenciones se recalculan siempre en el cliente al duplicar), solo para
-- poder rastrear el origen de un borrador si hace falta depurar.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS duplicated_from_invoice_id uuid REFERENCES public.invoices(id);
