ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS cancellation_status text
    CHECK (cancellation_status IN ('pending', 'cancelled', 'rejected', 'error')),
  ADD COLUMN IF NOT EXISTS cancellation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_replacement_uuid text,
  ADD COLUMN IF NOT EXISTS cancellation_pac_response jsonb;
