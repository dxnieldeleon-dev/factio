-- Part 2 of the fiscal-classification feature: retention (ISR/IVA retenido)
-- support. Today Factio always applies a flat 16% IVA traslado and never
-- computes retenciones or ObjetoImp dynamically, so any invoice to a persona
-- moral client is fiscally wrong (missing mandatory withholding). This adds
-- the columns the withholding engine writes to; the engine itself and the
-- rules table come in the next migrations.

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS isr_retencion_rate numeric(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS isr_retencion_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_retencion_rate numeric(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_retencion_amount numeric NOT NULL DEFAULT 0;

-- invoices.retentions_total already exists (numeric, unused so far) and
-- stays as the combined isr + iva retention total, same convention as
-- subtotal/iva_total/total.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS isr_retencion_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_retencion_total numeric NOT NULL DEFAULT 0;

-- Technology platforms (Uber/Didi/Airbnb-type) are always persona moral by
-- RFC length, so client_type can't distinguish them from a regular persona
-- moral client automatically — this is the manual override the withholding
-- engine checks first.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_technology_platform boolean NOT NULL DEFAULT false;

-- Every current activity_profiles row is a professional service (see
-- 20260730160000_activity_profiles_schema.sql seed) — this column exists so
-- future profiles (arrendamiento, etc.) can be classified without a schema
-- change, and so the withholding engine has something to key off of today.
ALTER TABLE public.activity_profiles
  ADD COLUMN IF NOT EXISTS activity_category text NOT NULL DEFAULT 'servicios_profesionales'
    CHECK (activity_category IN (
      'servicios_profesionales',
      'arrendamiento',
      'autotransporte_carga',
      'actividad_empresarial_general'
    ));
