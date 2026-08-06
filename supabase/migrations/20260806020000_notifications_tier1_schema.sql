-- Tier 1 (event-driven) notifications: campos adicionales en notifications
-- para poder llevar al usuario directo a la pantalla relevante (link) y
-- guardar contexto estructurado para depuración/futuras vistas (metadata),
-- más preferencias granulares por categoría en settings.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- kind sigue siendo texto libre; los valores que usa Tier 1 son:
--   'payment_failed', 'payment_recovered', 'plan_changed',
--   'invoice_stamped', 'invoice_stamp_error',
--   'invoice_cancelled', 'invoice_cancel_rejected',
--   'stamps_low', 'csd_uploaded'

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb
  DEFAULT '{
    "billing": true,
    "invoicing": true,
    "csd": true,
    "stamps": true
  }'::jsonb;

-- Filas existentes no reciben el default de ALTER TABLE automáticamente en
-- columnas ya pobladas (el DEFAULT solo aplica a filas nuevas); backfill
-- explícito para que los usuarios ya registrados no queden con NULL.
UPDATE public.settings
SET notification_preferences = '{
    "billing": true,
    "invoicing": true,
    "csd": true,
    "stamps": true
  }'::jsonb
WHERE notification_preferences IS NULL;
