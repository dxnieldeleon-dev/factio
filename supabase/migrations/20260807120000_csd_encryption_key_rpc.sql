-- Expone la llave de cifrado del CSD (guardada en Vault) solo a llamadas con
-- service_role — las Edge Functions no tienen acceso directo al esquema
-- `vault` vía PostgREST, así que se envuelve en una función SECURITY DEFINER
-- restringida, siguiendo el mismo patrón que el resto de RPCs sensibles
-- del proyecto (finalize_cfdi_stamp, etc.).
--
-- El secreto en sí (`csd_encryption_key`) se crea aparte, fuera de este
-- repo, con:
--   select vault.create_secret(
--     encode(gen_random_bytes(32), 'base64'),
--     'csd_encryption_key'
--   );
CREATE OR REPLACE FUNCTION public.get_csd_encryption_key()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'csd_encryption_key';
$$;

REVOKE ALL ON FUNCTION public.get_csd_encryption_key() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_csd_encryption_key() TO service_role;
