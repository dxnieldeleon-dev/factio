-- Cancellation had no safety net for ambiguous PAC failures: unlike stamping
-- (facturama-reconcile-cfdi / stamping_status='reconciliation_required'), a
-- failed cancelCfdi() call just returned the error and left
-- cancellation_status at NULL forever, even if Facturama had actually
-- processed the cancellation on their end before the error came back.
-- facturama-cancel-cfdi now checks the CFDI's real status at Facturama
-- before giving up, and records the attempt either way.
CREATE OR REPLACE FUNCTION public.mark_cfdi_cancellation_error(
  p_invoice_id uuid,
  p_pac_response jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invoices
  SET cancellation_status = 'error',
      cancellation_pac_response = p_pac_response
  WHERE id = p_invoice_id
    AND user_id = auth.uid()
    AND status = 'issued';
END;
$$;

REVOKE ALL ON FUNCTION public.mark_cfdi_cancellation_error(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_cfdi_cancellation_error(uuid, jsonb) TO authenticated;
