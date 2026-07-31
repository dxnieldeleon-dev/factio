-- Plans were recreated in Stripe (new Price/Product objects — Stripe prices
-- are immutable, so changing amounts always means new IDs) and the live
-- `plans` table was updated directly to match. This migration brings the
-- seed data in the repo in line with that, so a fresh environment bootstraps
-- with the same plan/price mapping instead of the old, now-inactive Stripe
-- price IDs from 20260730120000_billing_subscriptions_schema.sql.
--
-- Amounts (precio_mxn, facturas_incluidas) are unchanged — only the Stripe
-- price IDs and the `features` flags (carta_porte, complemento_pago) moved.
UPDATE public.plans SET stripe_price_id = 'price_1Tz8HOAQFAV3TTh4OqxgCN34', features = '{"carta_porte": false, "complemento_pago": false}'::jsonb WHERE key = 'basico';
UPDATE public.plans SET stripe_price_id = 'price_1Tz8HVAQFAV3TTh4R0oyb4z7', features = '{"carta_porte": false, "complemento_pago": true}'::jsonb WHERE key = 'estandar';
UPDATE public.plans SET stripe_price_id = 'price_1Tz8HcAQFAV3TTh4O3bRIjdR', features = '{"carta_porte": true, "complemento_pago": true}'::jsonb WHERE key = 'premium';
