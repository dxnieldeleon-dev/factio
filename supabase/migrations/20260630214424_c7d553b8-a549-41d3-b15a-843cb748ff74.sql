DROP POLICY IF EXISTS "Owner writes activity" ON public.activity_logs;
REVOKE INSERT, UPDATE, DELETE ON public.activity_logs FROM authenticated, anon;
GRANT ALL ON public.activity_logs TO service_role;