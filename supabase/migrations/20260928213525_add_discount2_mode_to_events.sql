ALTER TABLE public.events ADD COLUMN IF NOT EXISTS discount2_mode text NOT NULL DEFAULT 'client';
