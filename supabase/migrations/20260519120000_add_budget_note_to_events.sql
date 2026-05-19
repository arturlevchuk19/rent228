ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS budget_note text NOT NULL DEFAULT '';
