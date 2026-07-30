-- Catch-up migration: formalizes the billing/subscriptions schema that was
-- created directly against the live database (plans, subscriptions,
-- stamp_wallets, stamp_transactions + wallet trigger) so a fresh project can
-- reproduce it. Every statement is idempotent against the current production
-- schema.

CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  nombre text NOT NULL,
  precio_mxn numeric NOT NULL,
  facturas_incluidas integer NOT NULL,
  stripe_price_id text,
  stripe_price_id_test text,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies (id),
  plan_id uuid NOT NULL REFERENCES public.plans (id),
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  status text NOT NULL DEFAULT 'incomplete'
    CHECK (status IN ('incomplete', 'active', 'past_due', 'canceled', 'trialing')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stamp_wallets (
  company_id uuid PRIMARY KEY REFERENCES public.companies (id),
  balance integer NOT NULL DEFAULT 0,
  reserved_stamps integer NOT NULL DEFAULT 0 CHECK (reserved_stamps >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stamp_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions (id),
  type text NOT NULL CHECK (
    type IN (
      'grant_renovacion', 'grant_ajuste', 'grant_paquete_extra',
      'consumo', 'reversion_consumo', 'perdida_vencimiento'
    )
  ),
  amount integer NOT NULL,
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamp_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stamp_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_select_active" ON public.plans;
CREATE POLICY "plans_select_active"
ON public.plans FOR SELECT TO authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own"
ON public.subscriptions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = subscriptions.company_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "stamp_wallets_select_own" ON public.stamp_wallets;
CREATE POLICY "stamp_wallets_select_own"
ON public.stamp_wallets FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = stamp_wallets.company_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "stamp_tx_select_own" ON public.stamp_transactions;
CREATE POLICY "stamp_tx_select_own"
ON public.stamp_transactions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = stamp_transactions.company_id AND c.user_id = auth.uid()));

-- Clients never mutate plans, subscriptions or the wallet ledger directly —
-- only the service-role Stripe webhook and SECURITY DEFINER stamp functions do.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.plans FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.stamp_wallets FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.stamp_transactions FROM anon, authenticated;

-- Single source of truth for stamp_wallets.balance: any insert into
-- stamp_transactions adjusts the wallet by `amount`. Callers must never
-- also update stamp_wallets.balance directly (see finalize_cfdi_stamp fix).
CREATE OR REPLACE FUNCTION public.fn_update_stamp_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO stamp_wallets (company_id, balance, updated_at)
  VALUES (new.company_id, new.amount, now())
  ON CONFLICT (company_id) DO UPDATE
    SET balance = stamp_wallets.balance + new.amount,
        updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_wallet_update ON public.stamp_transactions;
CREATE TRIGGER trg_stamp_wallet_update
AFTER INSERT ON public.stamp_transactions
FOR EACH ROW EXECUTE FUNCTION public.fn_update_stamp_wallet();

INSERT INTO public.plans (key, nombre, precio_mxn, facturas_incluidas, stripe_price_id, stripe_price_id_test, features, is_active)
VALUES
  ('basico', 'Básico', 99.00, 10, 'price_1TqkedAQFAV3TTh4Q9mi8vWg', NULL, '{}'::jsonb, true),
  ('estandar', 'Estándar', 149.00, 25, 'price_1TqkegAQFAV3TTh4cKufUbV5', NULL, '{}'::jsonb, true),
  ('premium', 'Premium', 199.00, 50, 'price_1TqkekAQFAV3TTh4qupsStDh', NULL, '{}'::jsonb, true)
ON CONFLICT (key) DO NOTHING;
