ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS csd_serial_number text,
  ADD COLUMN IF NOT EXISTS csd_valid_from timestamptz,
  ADD COLUMN IF NOT EXISTS csd_valid_to timestamptz;