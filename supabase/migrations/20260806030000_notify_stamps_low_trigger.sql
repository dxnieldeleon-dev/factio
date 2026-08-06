-- Notifica cuando el saldo de timbres de una empresa cruza el umbral de 3
-- hacia abajo. stamp_wallets.balance solo se modifica a través del trigger
-- fn_update_stamp_wallet (AFTER INSERT ON stamp_transactions, que hace un
-- UPSERT sobre stamp_wallets) — este nuevo trigger reacciona a esa misma
-- actualización de balance, cualquiera sea su origen (consumo, ajuste, etc).
CREATE OR REPLACE FUNCTION public.notify_stamps_low()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_stamps_enabled boolean;
BEGIN
  -- Solo al cruzar el umbral hacia abajo — nunca en cada consumo sucesivo
  -- mientras el saldo ya está por debajo de 3, para evitar spam.
  IF NEW.balance <= 3 AND OLD.balance > 3 THEN
    SELECT c.user_id INTO v_user_id
    FROM public.companies c
    WHERE c.id = NEW.company_id;

    IF v_user_id IS NOT NULL THEN
      SELECT (s.notification_preferences->>'stamps')::boolean INTO v_stamps_enabled
      FROM public.settings s
      WHERE s.user_id = v_user_id;

      IF COALESCE(v_stamps_enabled, true) THEN
        INSERT INTO public.notifications (user_id, title, body, kind, link, metadata)
        VALUES (
          v_user_id,
          'Te quedan pocos timbres',
          'Tu saldo es de ' || NEW.balance
            || CASE WHEN NEW.balance = 1 THEN ' timbre.' ELSE ' timbres.' END
            || ' Considera actualizar tu plan para no quedarte sin poder facturar.',
          'stamps_low',
          '/profile',
          jsonb_build_object('balance', NEW.balance, 'company_id', NEW.company_id)
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_stamps_low ON public.stamp_wallets;
CREATE TRIGGER trg_notify_stamps_low
AFTER UPDATE OF balance ON public.stamp_wallets
FOR EACH ROW
WHEN (NEW.balance IS DISTINCT FROM OLD.balance)
EXECUTE FUNCTION public.notify_stamps_low();
