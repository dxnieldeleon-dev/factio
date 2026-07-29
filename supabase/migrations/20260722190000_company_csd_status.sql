ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS csd_status text NOT NULL DEFAULT 'pending'
    CHECK (csd_status IN ('pending', 'uploaded', 'error', 'expired')),
  ADD COLUMN IF NOT EXISTS csd_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS csd_last_error text;

UPDATE public.companies
SET csd_status = CASE
  WHEN csd_cer_url IS NOT NULL
    AND csd_key_url IS NOT NULL
    AND csd_serial_number IS NOT NULL
    AND csd_valid_to > now()
  THEN 'uploaded'
  ELSE 'pending'
END
WHERE csd_status = 'pending';
