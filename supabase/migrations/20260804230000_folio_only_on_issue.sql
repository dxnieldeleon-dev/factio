-- Folios used to be assigned at draft-insert time (BEFORE INSERT trigger),
-- so every failed stamp attempt (e.g. a bad fiscal address) permanently
-- burned a real folio number and left an orphaned draft behind — the retry
-- got the next folio, breaking continuity. Folios must only be consumed by
-- invoices that actually get stamped; drafts now sit at a shared 0
-- placeholder until finalize_cfdi_stamp assigns the real one atomically.

DROP INDEX IF EXISTS public.invoices_user_series_folio_key;
CREATE UNIQUE INDEX invoices_user_series_folio_key
  ON public.invoices (user_id, series, folio)
  WHERE status <> 'draft';

-- Existing orphaned drafts no longer need (or should keep) a real folio.
UPDATE public.invoices SET folio = 0 WHERE status = 'draft' AND folio <> 0;

CREATE OR REPLACE FUNCTION public.assign_invoice_folio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'draft' THEN
    NEW.folio := 0;
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text || ':' || NEW.series));
  SELECT COALESCE(MAX(folio), 0) + 1 INTO NEW.folio
  FROM public.invoices
  WHERE user_id = NEW.user_id AND series = NEW.series AND status <> 'draft';
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_cfdi_stamp(
  p_invoice_id uuid,
  p_uuid_fiscal text,
  p_xml_url text,
  p_pdf_url text,
  p_pac_response jsonb
)
RETURNS TABLE(balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
  v_series text;
  v_folio integer;
  v_balance integer;
BEGIN
  SELECT company_id, user_id, series INTO v_company_id, v_user_id, v_series
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

  -- Real folio assigned here, atomically, only once the CFDI is confirmed
  -- stamped — never at draft creation, so failed attempts never burn one.
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text || ':' || v_series));
  SELECT COALESCE(MAX(folio), 0) + 1 INTO v_folio
  FROM public.invoices
  WHERE user_id = v_user_id AND series = v_series AND status <> 'draft';

  UPDATE public.invoices
  SET status = 'issued',
      folio = v_folio,
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
