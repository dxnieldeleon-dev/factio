-- Reconciliation for invoices stuck in stamping_status = 'reconciliation_required'.
--
-- These are invoices where facturama-create-cfdi could not confirm the
-- outcome of a stamping attempt (network failure, 5xx, or a failure in a
-- step after Facturama already returned a CFDI id). The stamp reservation
-- is deliberately kept (never auto-released) because retrying blindly could
-- create a duplicate CFDI against the SAT — a legal document, not just a
-- row we can delete. Resolution has two safe paths:
--
--   1. We already know Facturama's CFDI id (captured in invoices.pac_response
--      by mark_cfdi_stamp_reconciliation_required): finalize_cfdi_stamp_reconciliation
--      re-derives the UUID/documents from Facturama and completes the invoice.
--   2. We don't know whether Facturama ever created it: a human confirms one
--      way or the other via Facturama's own dashboard, then calls either
--      finalize_cfdi_stamp_reconciliation (providing the id) or
--      release_cfdi_stamp_reconciliation (nothing was ever stamped).

-- Replaces the 2-argument version with a 3-argument one (different
-- signature in Postgres terms) so the old overload doesn't linger silently
-- ignoring pac_response.
DROP FUNCTION IF EXISTS public.mark_cfdi_stamp_reconciliation_required(uuid, text);

CREATE OR REPLACE FUNCTION public.mark_cfdi_stamp_reconciliation_required(
  p_invoice_id uuid,
  p_error text,
  p_pac_response jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invoices
  SET stamping_status = 'reconciliation_required',
      stamping_error = p_error,
      pac_response = COALESCE(p_pac_response, pac_response)
  WHERE id = p_invoice_id
    AND user_id = auth.uid()
    AND status = 'draft'
    AND stamping_status = 'processing';
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_cfdi_stamp_reconciliation(
  p_invoice_id uuid,
  p_uuid_fiscal text,
  p_xml_url text,
  p_pdf_url text,
  p_pac_response jsonb
)
RETURNS TABLE (balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_balance integer;
BEGIN
  SELECT company_id INTO v_company_id
  FROM public.invoices
  WHERE id = p_invoice_id
    AND user_id = auth.uid()
    AND status = 'draft'
    AND stamping_status = 'reconciliation_required'
  FOR UPDATE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'La factura no está en conciliación.' USING ERRCODE = 'P0001';
  END IF;

  SELECT w.balance INTO v_balance
  FROM public.stamp_wallets w
  WHERE w.company_id = v_company_id
    AND w.reserved_stamps > 0
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'No se encontró la reserva de timbre asociada a esta factura.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.invoices
  SET status = 'issued',
      uuid_fiscal = p_uuid_fiscal,
      xml_url = p_xml_url,
      pdf_url = p_pdf_url,
      issued_at = now(),
      pac_response = p_pac_response,
      stamping_status = 'completed',
      stamping_error = null
  WHERE id = p_invoice_id;

  UPDATE public.stamp_wallets
  SET reserved_stamps = GREATEST(reserved_stamps - 1, 0),
      updated_at = now()
  WHERE company_id = v_company_id;

  INSERT INTO public.stamp_transactions (company_id, type, amount, reference_id)
  VALUES (v_company_id, 'consumo', -1, p_invoice_id);

  SELECT w.balance INTO v_balance
  FROM public.stamp_wallets w
  WHERE w.company_id = v_company_id;

  RETURN QUERY SELECT v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_cfdi_stamp_reconciliation(
  p_invoice_id uuid,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.stamp_wallets wallet
  SET reserved_stamps = GREATEST(reserved_stamps - 1, 0)
  FROM public.invoices invoice
  WHERE invoice.id = p_invoice_id
    AND invoice.company_id = wallet.company_id
    AND invoice.user_id = auth.uid();

  UPDATE public.invoices
  SET stamping_status = 'ready',
      stamping_started_at = null,
      stamping_error = p_note
  WHERE id = p_invoice_id
    AND user_id = auth.uid()
    AND status = 'draft'
    AND stamping_status = 'reconciliation_required';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura no está en conciliación.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_cfdi_stamp_reconciliation_required(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_cfdi_stamp_reconciliation(uuid, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_cfdi_stamp_reconciliation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_cfdi_stamp_reconciliation_required(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_cfdi_stamp_reconciliation(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_cfdi_stamp_reconciliation(uuid, text) TO authenticated;
