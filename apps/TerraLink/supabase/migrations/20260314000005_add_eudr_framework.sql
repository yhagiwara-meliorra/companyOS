-- Add 'eudr' to disclosures framework options for EU Deforestation Regulation

ALTER TABLE public.disclosures
  DROP CONSTRAINT IF EXISTS disclosures_framework_check;

ALTER TABLE public.disclosures
  ADD CONSTRAINT disclosures_framework_check
  CHECK (framework IN ('tnfd', 'csrd', 'internal', 'eudr'));
