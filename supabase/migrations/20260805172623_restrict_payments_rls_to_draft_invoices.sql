DROP POLICY "Owner manages payments" ON public.payments;

CREATE POLICY "Users read own payments" ON public.payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users modify own draft-invoice payments" ON public.payments
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payments.invoice_id
        AND i.user_id = auth.uid()
        AND i.status = 'draft'::invoice_status
    )
  )
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own draft-invoice payments" ON public.payments
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payments.invoice_id
        AND i.user_id = auth.uid()
        AND i.status = 'draft'::invoice_status
    )
  );
