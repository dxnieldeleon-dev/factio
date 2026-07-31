-- Security audit finding (launch readiness pass, 2026-07-30): finalize_cfdi_stamp
-- and fn_update_stamp_wallet were reachable by `anon` via an implicit PUBLIC
-- grant (Postgres grants EXECUTE to PUBLIC by default on function creation;
-- earlier migrations only added explicit grants for authenticated/service_role
-- without revoking PUBLIC first). Not exploitable today — finalize_cfdi_stamp
-- filters on `user_id = auth.uid()`, which is NULL for anon and matches no
-- row — but it contradicts the stated security model in Architecture.md
-- ("EXECUTE restricted to authenticated") and is worth closing as
-- defense-in-depth before wider testing.
REVOKE EXECUTE ON FUNCTION public.finalize_cfdi_stamp(uuid, text, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_update_stamp_wallet() FROM PUBLIC;
