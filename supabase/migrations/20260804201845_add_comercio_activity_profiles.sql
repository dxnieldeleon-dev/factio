-- Adds the "Comercio / venta de productos" segment to the activity profile
-- catalog (see 20260730160000_activity_profiles_schema.sql). Unlike the
-- service profiles seeded there, commerce covers too wide a product variety
-- for a curated activity_profile_service_types catalog, so these ship with
-- none — the product form (src/routes/_authenticated/products.new.tsx)
-- falls back to the full SAT c_ClaveProdServ search instead when
-- activity_category = 'actividad_empresarial_general', a value already
-- allowed by activity_profiles_activity_category_check.
INSERT INTO public.activity_profiles (key, name, description, activity_category, sort_order) VALUES
  ('comercio_ecommerce', 'Comercio y venta de productos', 'Tienda en línea o física que vende productos en general.', 'actividad_empresarial_general', 500),
  ('alimentos_bebidas', 'Alimentos y bebidas', 'Venta de alimentos preparados, abarrotes o bebidas.', 'actividad_empresarial_general', 510),
  ('moda_accesorios', 'Moda y accesorios', 'Ropa, calzado, joyería y accesorios.', 'actividad_empresarial_general', 520)
ON CONFLICT (key) DO NOTHING;
