-- subscriptions.status solo permitía 5 de los 8 estados reales que Stripe
-- puede mandar en sus webhooks. Cuando llegaba 'incomplete_expired',
-- 'unpaid' o 'paused' (p. ej. un cobro fallido o una suscripción pausada),
-- el upsert del stripe-webhook violaba este CHECK y la función regresaba
-- 500 — Stripe reintentaba el evento sin éxito y la suscripción se quedaba
-- desincronizada hasta corregirla a mano.
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN (
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
  ));
