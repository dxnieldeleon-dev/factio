-- Editable rules table for ISR/IVA retention: which rate applies given the
-- issuer's tax_regime, the client's type (by RFC length, or the explicit
-- is_technology_platform override), and the activity category. Read-only
-- reference data for the app — same access pattern as activity_profiles/
-- plans: authenticated can SELECT active+in-force rows, only service_role
-- writes. Editing a rate here (e.g. after a reforma fiscal) never requires a
-- redeploy.
CREATE TABLE public.tax_withholding_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_regime text NOT NULL,
  client_type text NOT NULL CHECK (client_type IN ('persona_fisica', 'persona_moral', 'plataforma_tecnologica')),
  activity_category text NOT NULL CHECK (activity_category IN (
    'servicios_profesionales',
    'arrendamiento',
    'autotransporte_carga',
    'actividad_empresarial_general'
  )),
  isr_retencion_pct numeric(7,4) NOT NULL DEFAULT 0,
  iva_retencion_pct numeric(7,4) NOT NULL DEFAULT 0,
  objeto_imp text NOT NULL DEFAULT '02',
  fundamento_legal text,
  notes text,
  vigente_desde date NOT NULL DEFAULT '2026-01-01',
  vigente_hasta date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tax_regime, client_type, activity_category, vigente_desde)
);

ALTER TABLE public.tax_withholding_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tax_withholding_rules_select_active" ON public.tax_withholding_rules;
CREATE POLICY "tax_withholding_rules_select_active"
ON public.tax_withholding_rules FOR SELECT TO authenticated
USING (is_active = true);

GRANT SELECT ON public.tax_withholding_rules TO authenticated;
GRANT ALL ON public.tax_withholding_rules TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tax_withholding_rules FROM anon, authenticated;

CREATE TRIGGER tax_withholding_rules_updated_at
BEFORE UPDATE ON public.tax_withholding_rules
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SEED: confirmed 2026 rates ============
-- RESICO (626) and Actividad Empresarial y Profesional (612), for servicios
-- profesionales and arrendamiento. Persona-física-client rows are seeded
-- explicitly at 0% (rather than left absent) so a lookup miss always means
-- "no rule configured yet", never "silently assume zero" — the engine
-- treats those differently (a miss should be loud, a real 0% rule is a
-- deliberate, on-the-record fact).
INSERT INTO public.tax_withholding_rules
  (tax_regime, client_type, activity_category, isr_retencion_pct, iva_retencion_pct, fundamento_legal, notes)
VALUES
  ('626', 'persona_moral', 'servicios_profesionales', 1.25, 10.6667,
    'Art. 113-J LISR / Art. 1-A LIVA',
    'Regla 3.13.26 RMF 2026: releva de la retención del 1.25% ISR cuando el ingreso anual del contribuyente no rebasa ~$900,000 MXN y se dedica exclusivamente a esa actividad. No automatizado en esta fase — requiere trackear ingreso acumulado anual.'),
  ('626', 'persona_moral', 'arrendamiento', 1.25, 10.6667,
    'Art. 113-J LISR / Art. 1-A LIVA',
    'Misma excepción de la Regla 3.13.26 RMF 2026 que en servicios profesionales — ver nota en esa fila.'),
  ('626', 'persona_fisica', 'servicios_profesionales', 0, 0,
    'N/A', 'La retención solo aplica cuando quien paga es persona moral.'),
  ('626', 'persona_fisica', 'arrendamiento', 0, 0,
    'N/A', 'La retención solo aplica cuando quien paga es persona moral.'),
  ('612', 'persona_moral', 'servicios_profesionales', 10, 10.6667,
    'Art. 106 LISR / Art. 1-A LIVA', NULL),
  ('612', 'persona_moral', 'arrendamiento', 10, 10.6667,
    'Art. 106 LISR / Art. 1-A LIVA', NULL),
  ('612', 'persona_fisica', 'servicios_profesionales', 0, 0,
    'N/A', 'La retención solo aplica cuando quien paga es persona moral.'),
  ('612', 'persona_fisica', 'arrendamiento', 0, 0,
    'N/A', 'La retención solo aplica cuando quien paga es persona moral.');
