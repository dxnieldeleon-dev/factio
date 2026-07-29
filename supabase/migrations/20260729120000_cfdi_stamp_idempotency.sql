-- A CFDI must be claimed atomically before calling the PAC. This prevents
-- parallel browser requests from timbrar the same draft more than once.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stamping_status text NOT NULL DEFAULT 'ready'
    CHECK (stamping_status IN ('ready', 'processing', 'completed', 'reconciliation_required')),
  ADD COLUMN IF NOT EXISTS stamping_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS stamping_error text;

ALTER TABLE public.stamp_wallets
  ADD COLUMN IF NOT EXISTS reserved_stamps integer NOT NULL DEFAULT 0
    CHECK (reserved_stamps >= 0);

CREATE OR REPLACE FUNCTION public.assign_invoice_folio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text || ':' || NEW.series));
  SELECT COALESCE(MAX(folio), 0) + 1 INTO NEW.folio
  FROM public.invoices
  WHERE user_id = NEW.user_id AND series = NEW.series;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_invoice_folio_before_insert ON public.invoices;
CREATE TRIGGER assign_invoice_folio_before_insert
BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.assign_invoice_folio();

CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_series_folio_key
ON public.invoices (user_id, series, folio);

UPDATE public.invoices
SET stamping_status = 'completed'
WHERE status IN ('issued', 'cancelled');

CREATE OR REPLACE FUNCTION public.claim_cfdi_stamp(p_invoice_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.invoice_status;
  v_stamping_status text;
  v_company_id uuid;
BEGIN
  SELECT status, stamping_status, company_id
    INTO v_status, v_stamping_status, v_company_id
  FROM public.invoices
  WHERE id = p_invoice_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND OR v_status <> 'draft' OR v_stamping_status <> 'ready' THEN
    RETURN false;
  END IF;

  UPDATE public.stamp_wallets
  SET reserved_stamps = reserved_stamps + 1
  WHERE company_id = v_company_id
    AND balance > reserved_stamps;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.invoices
  SET stamping_status = 'processing',
      stamping_started_at = now(),
      stamping_error = null
  WHERE id = p_invoice_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_cfdi_stamp_claim(
  p_invoice_id uuid,
  p_error text
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
      stamping_error = p_error
  WHERE id = p_invoice_id
    AND user_id = auth.uid()
    AND status = 'draft'
    AND stamping_status = 'processing';
END;
$$;

-- An in-flight claim is only released when Facturama definitively rejects the
-- request (4xx). Transport failures and 5xx responses require reconciliation.
CREATE OR REPLACE FUNCTION public.mark_cfdi_stamp_reconciliation_required(
  p_invoice_id uuid,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invoices
  SET stamping_status = 'reconciliation_required',
      stamping_error = p_error
  WHERE id = p_invoice_id
    AND user_id = auth.uid()
    AND status = 'draft'
    AND stamping_status = 'processing';
END;
$$;

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

  UPDATE public.stamp_wallets
  SET balance = balance - 1,
      reserved_stamps = GREATEST(reserved_stamps - 1, 0),
      updated_at = now()
  WHERE company_id = v_company_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.stamp_transactions (company_id, type, amount, reference_id)
  VALUES (v_company_id, 'consumption', -1, p_invoice_id);

  RETURN QUERY SELECT v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_cfdi_stamp(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_cfdi_stamp_claim(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_cfdi_stamp_reconciliation_required(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_cfdi_stamp(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_cfdi_stamp_claim(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_cfdi_stamp_reconciliation_required(uuid, text) TO authenticated;
