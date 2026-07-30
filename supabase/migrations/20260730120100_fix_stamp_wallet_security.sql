-- Two issues found in the live stamp-wallet accounting, both fixed here:
--
-- 1. finalize_cfdi_stamp() decremented stamp_wallets.balance directly AND
--    inserted into stamp_transactions, whose trg_stamp_wallet_update trigger
--    ALSO applies the -1 delta. Every stamped invoice was charging 2 stamps
--    instead of 1. The fix keeps a single source of truth: the transaction
--    log (via the trigger). This function only clears the reservation and
--    re-reads the resulting balance.
--
-- 2. consume_invoice_stamp / fn_consume_stamp / reverse_invoice_stamp are
--    SECURITY DEFINER functions that take an arbitrary company_id with no
--    ownership check, yet had EXECUTE granted to PUBLIC/anon/authenticated.
--    Any signed-in (or anonymous, via the public anon key) caller could
--    drain or credit any other company's stamp wallet through
--    supabase.rpc(...). None of these are called by any Edge Function today
--    (facturama-create-cfdi uses claim/finalize/release_cfdi_stamp_claim,
--    which already check user_id = auth.uid()), so revoking public access
--    is safe.

CREATE OR REPLACE FUNCTION public.finalize_cfdi_stamp(
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
    AND stamping_status = 'processing'
  FOR UPDATE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'La factura no está disponible para finalizar el timbrado.' USING ERRCODE = 'P0001';
  END IF;

  SELECT w.balance INTO v_balance
  FROM public.stamp_wallets w
  WHERE w.company_id = v_company_id
    AND w.reserved_stamps > 0
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < 1 THEN
    RAISE EXCEPTION 'No hay timbres disponibles para emitir esta factura.' USING ERRCODE = 'P0001';
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

  -- Only the reservation is cleared here. The actual balance debit happens
  -- exactly once, via trg_stamp_wallet_update reacting to the insert below.
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

REVOKE EXECUTE ON FUNCTION public.consume_invoice_stamp(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_consume_stamp(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reverse_invoice_stamp(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_invoice_stamp(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_consume_stamp(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_invoice_stamp(uuid, uuid) TO service_role;

ALTER FUNCTION public.fn_consume_stamp(uuid, uuid) SET search_path = public;
