ALTER TABLE public.events ADD COLUMN IF NOT EXISTS discount2_enabled boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS discount2_percent numeric NOT NULL DEFAULT 0;
