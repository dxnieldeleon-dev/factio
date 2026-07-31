-- has_role(_user_id, _role) is intentionally restricted to service_role: it
-- takes an arbitrary user_id, so exposing it to authenticated would let any
-- user probe anyone else's role membership. History's reconciliation UI
-- needs to know only whether the *calling* user is an admin (to gate the
-- Facturama-specific manual-resolution controls, which assume operator
-- access to the PAC dashboard that regular users don't have) — so this
-- wraps has_role with auth.uid(), leaking nothing beyond the caller's own
-- role.
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
$$;

REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
