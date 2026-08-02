-- Structure-only placeholder for platform (Uber/Didi/Airbnb-type) ISR
-- withholding brackets. Art. 113-A LISR rates are tiered by monthly income
-- and activity type, and are republished yearly in the LIF — the 2026
-- figures were not available/confirmed to seed here, and an incorrect rate
-- is worse than no rate. Left empty on purpose: the withholding engine
-- checks this table for plataforma_tecnologica clients and, finding it
-- empty, must skip retention and log a warning rather than fail silently
-- or guess. Populate once the official 2026 Art. 113-A LISR / Art. 18-J
-- LIVA tables are confirmed against SAT/DOF.
CREATE TABLE public.platform_isr_brackets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_activity_type text NOT NULL CHECK (platform_activity_type IN (
    'transporte_entrega',
    'hospedaje',
    'enajenacion_bienes_servicios'
  )),
  min_monthly_income numeric NOT NULL,
  max_monthly_income numeric,
  isr_pct numeric(7,4) NOT NULL,
  iva_retencion_con_rfc_pct numeric(7,4) NOT NULL DEFAULT 8,
  iva_retencion_sin_rfc_pct numeric(7,4) NOT NULL DEFAULT 100,
  fundamento_legal text,
  vigente_desde date NOT NULL DEFAULT '2026-01-01',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_isr_brackets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_isr_brackets_select_active" ON public.platform_isr_brackets;
CREATE POLICY "platform_isr_brackets_select_active"
ON public.platform_isr_brackets FOR SELECT TO authenticated
USING (is_active = true);

GRANT SELECT ON public.platform_isr_brackets TO authenticated;
GRANT ALL ON public.platform_isr_brackets TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.platform_isr_brackets FROM anon, authenticated;

CREATE TRIGGER platform_isr_brackets_updated_at
BEFORE UPDATE ON public.platform_isr_brackets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- NO seed rows — see comment above.
