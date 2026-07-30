-- Part 1 of the fiscal-classification feature: curated activity profiles that
-- let a persona física without fiscal knowledge pick "lo que hace" instead of
-- hunting for a SAT product/service key. Each profile ships a handful of
-- pre-mapped service types (sat_key + sat_unit already verified against the
-- SAT c_ClaveProdServ / c_ClaveUnidad catalogs). Products are untouched —
-- this only powers the simplified "add service" form.

CREATE TABLE IF NOT EXISTS public.activity_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_profile_service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_profile_id uuid NOT NULL REFERENCES public.activity_profiles (id) ON DELETE CASCADE,
  name text NOT NULL,
  sat_key text NOT NULL,
  sat_unit text NOT NULL,
  default_unit_price numeric(14,4),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_profile_service_types_profile_idx
  ON public.activity_profile_service_types (activity_profile_id);

-- SAT/INEGI economic-activity catalog (SCIAN), used by onboarding (Part 3) to
-- match text extracted from a Constancia de Situación Fiscal against a
-- suggested activity_profile_id. Deliberately a small, verified subset —
-- extend as more SCIAN entries are confirmed, same convention already used
-- by src/lib/sat-catalogs.ts for the CFDI catalogs.
CREATE TABLE IF NOT EXISTS public.sat_economic_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scian_code text UNIQUE,
  description text NOT NULL,
  activity_profile_id uuid REFERENCES public.activity_profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS activity_profile_id uuid REFERENCES public.activity_profiles (id) ON DELETE SET NULL;

ALTER TABLE public.activity_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_profile_service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sat_economic_activities ENABLE ROW LEVEL SECURITY;

-- Read-only reference catalogs: every authenticated user can read active
-- rows, nobody but service_role can write. Mirrors the "plans" pattern in
-- 20260730120000_billing_subscriptions_schema.sql.
DROP POLICY IF EXISTS "activity_profiles_select_active" ON public.activity_profiles;
CREATE POLICY "activity_profiles_select_active"
ON public.activity_profiles FOR SELECT TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "activity_profile_service_types_select_active" ON public.activity_profile_service_types;
CREATE POLICY "activity_profile_service_types_select_active"
ON public.activity_profile_service_types FOR SELECT TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "sat_economic_activities_select_all" ON public.sat_economic_activities;
CREATE POLICY "sat_economic_activities_select_all"
ON public.sat_economic_activities FOR SELECT TO authenticated
USING (true);

GRANT SELECT ON public.activity_profiles TO authenticated;
GRANT SELECT ON public.activity_profile_service_types TO authenticated;
GRANT SELECT ON public.sat_economic_activities TO authenticated;
GRANT ALL ON public.activity_profiles TO service_role;
GRANT ALL ON public.activity_profile_service_types TO service_role;
GRANT ALL ON public.sat_economic_activities TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.activity_profiles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.activity_profile_service_types FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sat_economic_activities FROM anon, authenticated;

-- ============ SEED: activity profiles + service types ============
-- sat_key / sat_unit verified against the public c_ClaveProdServ / c_ClaveUnidad
-- CFDI 4.0 catalogs (veinte.mx / SAT Anexo 20 lookups), July 2026.

INSERT INTO public.activity_profiles (key, name, description, sort_order) VALUES
  ('consultoria_negocios', 'Consultoría de negocios', 'Asesoría estratégica, administrativa o de procesos para empresas.', 10),
  ('desarrollo_software', 'Desarrollo de software y TI', 'Programación, sistemas, sitios web y soporte técnico.', 20),
  ('diseno_grafico', 'Diseño gráfico y creativo', 'Identidad de marca, diseño editorial y material publicitario.', 30),
  ('nutricion', 'Nutrición y dietética', 'Consulta y planes de alimentación personalizados.', 40),
  ('psicologia', 'Psicología y salud mental', 'Consulta y terapia psicológica individual, de pareja o familiar.', 50),
  ('medicina_general', 'Medicina general', 'Consulta médica general y de seguimiento.', 60),
  ('fisioterapia', 'Fisioterapia y rehabilitación', 'Sesiones de fisioterapia y terapias de rehabilitación.', 70),
  ('educacion_coaching', 'Educación, capacitación y coaching', 'Coaching ejecutivo, capacitación empresarial y talleres.', 80),
  ('arquitectura', 'Arquitectura', 'Proyecto arquitectónico, dirección de obra y diseño de interiores.', 90),
  ('contabilidad', 'Contabilidad y finanzas', 'Contabilidad, teneduría de libros y nómina.', 100),
  ('servicios_legales', 'Servicios legales', 'Asesoría legal, contratos y representación en disputas.', 110),
  ('fotografia_video', 'Fotografía y video', 'Sesiones fotográficas, cobertura de eventos y fotografía aérea.', 120),
  ('belleza_estetica', 'Belleza y estética', 'Corte y tinte, tratamientos faciales y corporales.', 130),
  ('marketing_digital', 'Marketing y publicidad digital', 'Redes sociales, campañas digitales y contenido publicitario.', 140),
  ('traduccion_redaccion', 'Traducción y redacción', 'Traducción escrita, redacción técnica y edición.', 150),
  ('entrenamiento_fisico', 'Entrenamiento físico y acondicionamiento', 'Clases de acondicionamiento físico y entrenamiento personalizado.', 160)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.activity_profile_service_types (activity_profile_id, name, sat_key, sat_unit, sort_order)
SELECT p.id, s.name, s.sat_key, s.sat_unit, s.sort_order
FROM (VALUES
  ('consultoria_negocios', 'Consultoría estratégica', '80101500', 'E48', 10),
  ('consultoria_negocios', 'Consultoría en administración', '80101500', 'E48', 20),
  ('consultoria_negocios', 'Asesoría en procesos y operaciones', '80101500', 'E48', 30),

  ('desarrollo_software', 'Desarrollo de software a la medida', '81112000', 'E48', 10),
  ('desarrollo_software', 'Soporte técnico y administración de sistemas', '81111500', 'E48', 20),
  ('desarrollo_software', 'Diseño y desarrollo de sitios web', '81112103', 'E48', 30),
  ('desarrollo_software', 'Mantenimiento de aplicaciones', '81112000', 'HUR', 40),

  ('diseno_grafico', 'Diseño de identidad de marca / logotipo', '82141504', 'E48', 10),
  ('diseno_grafico', 'Diseño editorial e ilustración', '82141500', 'E48', 20),
  ('diseno_grafico', 'Diseño de material publicitario', '82101802', 'E48', 30),

  ('nutricion', 'Consulta de nutrición', '85151600', 'E48', 10),
  ('nutricion', 'Plan de alimentación personalizado', '85151600', 'E48', 20),
  ('nutricion', 'Seguimiento nutricional', '85151600', 'HUR', 30),

  ('psicologia', 'Consulta de psicología', '85121608', 'E48', 10),
  ('psicologia', 'Terapia individual', '85121608', 'HUR', 20),
  ('psicologia', 'Terapia de pareja o familiar', '85121608', 'E48', 30),

  ('medicina_general', 'Consulta médica general', '85121502', 'E48', 10),
  ('medicina_general', 'Consulta de seguimiento', '85121502', 'E48', 20),

  ('fisioterapia', 'Sesión de fisioterapia', '85122101', 'E48', 10),
  ('fisioterapia', 'Terapia de rehabilitación', '85122101', 'HUR', 20),

  ('educacion_coaching', 'Coaching ejecutivo', '86132001', 'E48', 10),
  ('educacion_coaching', 'Capacitación empresarial', '86132000', 'E48', 20),
  ('educacion_coaching', 'Taller o curso de habilidades', '86101810', 'E48', 30),

  ('arquitectura', 'Proyecto arquitectónico', '81101508', 'E48', 10),
  ('arquitectura', 'Dirección y supervisión de obra', '81101513', 'E48', 20),
  ('arquitectura', 'Diseño de interiores', '81101508', 'E48', 30),

  ('contabilidad', 'Servicios de contabilidad', '84111500', 'E48', 10),
  ('contabilidad', 'Teneduría de libros', '84111504', 'E48', 20),
  ('contabilidad', 'Cálculo y timbrado de nómina', '84111505', 'E48', 30),

  ('servicios_legales', 'Asesoría legal', '80121601', 'E48', 10),
  ('servicios_legales', 'Elaboración de contratos', '80121601', 'E48', 20),
  ('servicios_legales', 'Representación en disputas laborales', '80121707', 'E48', 30),

  ('fotografia_video', 'Sesión fotográfica en estudio', '82131604', 'E48', 10),
  ('fotografia_video', 'Cobertura de eventos', '82131600', 'E48', 20),
  ('fotografia_video', 'Fotografía aérea (dron)', '82131601', 'E48', 30),

  ('belleza_estetica', 'Corte y tinte de cabello', '91101701', 'E48', 10),
  ('belleza_estetica', 'Tratamiento facial', '91101601', 'E48', 20),
  ('belleza_estetica', 'Tratamiento corporal / spa', '91101600', 'E48', 30),

  ('marketing_digital', 'Gestión de redes sociales', '82101903', 'E48', 10),
  ('marketing_digital', 'Campañas de publicidad digital', '82101500', 'E48', 20),
  ('marketing_digital', 'Producción de contenido publicitario', '82101802', 'E48', 30),

  ('traduccion_redaccion', 'Traducción de documentos', '82111804', 'E48', 10),
  ('traduccion_redaccion', 'Redacción técnica', '82111500', 'E48', 20),
  ('traduccion_redaccion', 'Edición de textos', '82111801', 'E48', 30),

  ('entrenamiento_fisico', 'Clases de acondicionamiento físico', '91101504', 'E48', 10),
  ('entrenamiento_fisico', 'Entrenamiento personalizado', '91101504', 'HUR', 20),
  ('entrenamiento_fisico', 'Servicios en gimnasio o centro de salud', '91101501', 'E48', 30)
) AS s(profile_key, name, sat_key, sat_unit, sort_order)
JOIN public.activity_profiles p ON p.key = s.profile_key
WHERE NOT EXISTS (
  SELECT 1 FROM public.activity_profile_service_types t
  WHERE t.activity_profile_id = p.id AND t.name = s.name
);

-- ============ SEED: verified SCIAN economic activities → profile mapping ============
-- Small, verified subset (INEGI SCIAN 2018 codes confirmed via public sources,
-- July 2026). Extend as more codes are confirmed — see comment above the
-- table definition.
INSERT INTO public.sat_economic_activities (scian_code, description, activity_profile_id)
SELECT a.scian_code, a.description, p.id
FROM (VALUES
  ('541611', 'Servicios de consultoría en administración', 'consultoria_negocios'),
  ('541510', 'Servicios de diseño de sistemas de cómputo y servicios relacionados', 'desarrollo_software'),
  ('621111', 'Consultorios de medicina general del sector privado', 'medicina_general'),
  ('621331', 'Consultorios de psicología del sector privado', 'psicologia'),
  ('812110', 'Salones y clínicas de belleza y peluquerías', 'belleza_estetica')
) AS a(scian_code, description, profile_key)
JOIN public.activity_profiles p ON p.key = a.profile_key
ON CONFLICT (scian_code) DO NOTHING;
