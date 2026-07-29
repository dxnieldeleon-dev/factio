-- Fiscal records become immutable once issued. PAC-driven changes are persisted only
-- through SECURITY DEFINER functions that still assert the calling user owns the invoice.

DROP POLICY IF EXISTS "Owner manages invoices" ON public.invoices;

CREATE POLICY "Users read own invoices"
ON public.invoices FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users create own draft invoices"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'draft');

CREATE POLICY "Users update own draft invoices"
ON public.invoices FOR UPDATE TO authenticated
USING (auth.uid() = user_id AND status = 'draft')
WITH CHECK (auth.uid() = user_id AND status = 'draft');

CREATE POLICY "Users delete own draft invoices"
ON public.invoices FOR DELETE TO authenticated
USING (auth.uid() = user_id AND status = 'draft');

DROP POLICY IF EXISTS "Owner manages invoice_items" ON public.invoice_items;

CREATE POLICY "Users read own invoice items"
ON public.invoice_items FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users manage items on own draft invoices"
ON public.invoice_items FOR ALL TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.invoices invoice
    WHERE invoice.id = invoice_items.invoice_id
      AND invoice.user_id = auth.uid()
      AND invoice.status = 'draft'
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.invoices invoice
    WHERE invoice.id = invoice_items.invoice_id
      AND invoice.user_id = auth.uid()
      AND invoice.status = 'draft'
  )
);

REVOKE INSERT, UPDATE, DELETE ON public.stamp_wallets FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.stamp_transactions FROM authenticated;

CREATE OR REPLACE FUNCTION public.finalize_cfdi_cancellation(
  p_invoice_id uuid,
  p_motive text,
  p_uuid_replacement text,
  p_cancelled boolean,
  p_request_date timestamptz,
  p_cancelled_at timestamptz,
  p_pac_response jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invoices
  SET status = CASE WHEN p_cancelled THEN 'cancelled'::public.invoice_status ELSE status END,
      cancelled_at = CASE WHEN p_cancelled THEN COALESCE(p_cancelled_at, now()) ELSE cancelled_at END,
      cancellation_reason = p_motive,
      cancellation_replacement_uuid = p_uuid_replacement,
      cancellation_requested_at = CASE
        WHEN p_cancelled THEN cancellation_requested_at
        ELSE COALESCE(p_request_date, now())
      END,
      cancellation_status = CASE WHEN p_cancelled THEN 'cancelled' ELSE 'pending' END,
      cancellation_pac_response = p_pac_response
  WHERE id = p_invoice_id
    AND user_id = auth.uid()
    AND status = 'issued';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura no está disponible para cancelación.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_cfdi_cancellation(uuid, text, text, boolean, timestamptz, timestamptz, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_cfdi_cancellation(uuid, text, text, boolean, timestamptz, timestamptz, jsonb)
  TO authenticated;
