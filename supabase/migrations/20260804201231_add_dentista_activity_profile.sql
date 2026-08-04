-- Backfills the local migrations directory to match what's already applied
-- on the remote project (this migration ran there but the file was never
-- committed to the repo). Adds the "Dentista" service profile alongside its
-- curated service types, same pattern as 20260730160000_activity_profiles_schema.sql.
WITH new_profile AS (
  INSERT INTO activity_profiles (key, name, description, activity_category, sort_order, is_active)
  VALUES (
    'dentista',
    'Dentista',
    'Consulta dental, limpieza, ortodoncia y cirugía oral',
    'servicios_profesionales',
    65,
    true
  )
  RETURNING id
)
INSERT INTO activity_profile_service_types (activity_profile_id, name, sat_key, sat_unit, sort_order, is_active)
SELECT id, v.name, v.sat_key, v.sat_unit, v.sort_order, true
FROM new_profile, (VALUES
  ('Consulta dental general', '85122001', 'E48', 10),
  ('Limpieza dental', '85122000', 'E48', 20),
  ('Tratamiento de ortodoncia', '85122005', 'E48', 30),
  ('Cirugía oral', '85122004', 'E48', 40)
) AS v(name, sat_key, sat_unit, sort_order);
