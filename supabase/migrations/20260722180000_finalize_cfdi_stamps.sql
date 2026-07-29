-- CFDI artifacts remain private; the Edge Function writes them using the user's JWT.
INSERT INTO storage.buckets (id, name, public)
VALUES ('cfdi-documents', 'cfdi-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read own CFDI documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cfdi-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users write own CFDI documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cfdi-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own CFDI documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'cfdi-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'cfdi-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own CFDI documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cfdi-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS pac_response jsonb;

-- One database transaction protects invoice persistence, wallet decrement and audit trail.
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
  FOR UPDATE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'La factura no está disponible para timbrado.' USING ERRCODE = 'P0001';
  END IF;

  SELECT w.balance INTO v_balance
  FROM public.stamp_wallets w
  WHERE w.company_id = v_company_id
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
      pac_response = p_pac_response
  WHERE id = p_invoice_id;

  UPDATE public.stamp_wallets
  SET balance = balance - 1,
      updated_at = now()
  WHERE company_id = v_company_id
  RETURNING balance INTO v_balance;

  INSERT INTO public.stamp_transactions (company_id, type, amount, reference_id)
  VALUES (v_company_id, 'consumption', -1, p_invoice_id);

  RETURN QUERY SELECT v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_cfdi_stamp(uuid, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_cfdi_stamp(uuid, text, text, text, jsonb) TO authenticated;
