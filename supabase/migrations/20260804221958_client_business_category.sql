-- Lets a client be tagged with a business category (giro del negocio) so the
-- UI can show a meaningful icon per invoice instead of a generic one. Nullable
-- with no default: existing clients stay unclassified until the user picks a
-- category, and the app falls back to a generic icon for null.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS business_category text
    CHECK (business_category IN (
      'consultoria',
      'comercio',
      'diseno',
      'tecnologia',
      'taller',
      'otro'
    ));
