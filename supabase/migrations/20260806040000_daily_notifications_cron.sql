-- Programa daily-notifications-check una vez al día vía pg_cron + pg_net.
-- 15:00 UTC = 09:00 hora CDMX (México es UTC-6 todo el año desde que se
-- eliminó el horario de verano nacional en 2022).
--
-- El header Authorization necesita la service_role key del proyecto. Nunca
-- se hardcodea aquí (quedaría en el historial de git) — se referencia por
-- nombre desde Supabase Vault. PASO MANUAL REQUERIDO UNA SOLA VEZ, fuera de
-- este repo, en el SQL Editor del dashboard de Supabase (con la
-- service_role key real del proyecto, NUNCA pegada en este archivo ni en el
-- chat de esta sesión):
--
--   select vault.create_secret(
--     '<service_role_key>',
--     'daily_notifications_service_role_key'
--   );
--
-- Sin ese secreto, el cron corre pero cada llamada regresa 401 (el Edge
-- Function no otorga nada) — falla en silencio, sin efectos para usuarios.

select cron.schedule(
  'daily-notifications-check',
  '0 15 * * *',
  $$
  select net.http_post(
    url := 'https://fziszuqxogariodpbbcx.supabase.co/functions/v1/daily-notifications-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'daily_notifications_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
