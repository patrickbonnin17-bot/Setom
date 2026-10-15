ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS contract_duration_years integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS prices_renegotiable boolean NOT NULL DEFAULT true;
