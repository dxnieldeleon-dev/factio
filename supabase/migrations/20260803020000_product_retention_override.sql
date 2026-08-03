-- Retención ISR/IVA configurable por producto/servicio: un override manual
-- opcional sobre el motor automático de retenciones (que calcula por
-- régimen del emisor + tipo de cliente en supabase/functions/_shared/tax/
-- withholding.ts). NULL = "usa el cálculo automático" (comportamiento
-- actual, sin cambios). No-NULL = fuerza esa tasa para este producto,
-- pero SOLO cuando el receptor es persona moral — a persona física nunca
-- se le retiene, sin excepción, sin importar lo que diga el producto.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS isr_retencion_rate numeric,
  ADD COLUMN IF NOT EXISTS iva_retencion_rate numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_isr_retencion_rate_range'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_isr_retencion_rate_range
        CHECK (isr_retencion_rate IS NULL OR (isr_retencion_rate >= 0 AND isr_retencion_rate <= 1));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_iva_retencion_rate_range'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_iva_retencion_rate_range
        CHECK (iva_retencion_rate IS NULL OR (iva_retencion_rate >= 0 AND iva_retencion_rate <= 1));
  END IF;
END $$;
