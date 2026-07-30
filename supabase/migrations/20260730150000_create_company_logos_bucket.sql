-- The company-logos bucket was never created: migration 20260704050544
-- added RLS policies for it (storage.objects, bucket_id = 'company-logos')
-- but no corresponding row in storage.buckets ever existed, so any upload
-- failed with "Bucket not found". Onboarding's optional logo upload
-- (src/routes/onboarding.tsx) is the first thing that hits this bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', false)
ON CONFLICT (id) DO NOTHING;
