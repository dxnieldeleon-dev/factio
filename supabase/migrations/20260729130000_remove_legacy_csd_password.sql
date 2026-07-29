-- CSD passwords are used only in memory for validation and PAC registration.
-- They must never persist in the application database.
ALTER TABLE public.companies
  DROP COLUMN IF EXISTS csd_password_encrypted;
