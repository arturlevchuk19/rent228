ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS budget_days integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS budget_totals_mode text NOT NULL DEFAULT 'combined_only';

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_budget_days_check,
  ADD CONSTRAINT events_budget_days_check CHECK (budget_days >= 1),
  DROP CONSTRAINT IF EXISTS events_budget_totals_mode_check,
  ADD CONSTRAINT events_budget_totals_mode_check CHECK (budget_totals_mode IN ('combined_only', 'day1_plus_combined'));
