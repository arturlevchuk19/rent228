/*
  # Add multi_day_rate_override to budget_items

  1. Changes
    - Add `multi_day_rate_override` decimal(10,2), nullable
    - Restrict value range to 0..1 via CHECK constraint
*/

ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS multi_day_rate_override decimal(10,2);

ALTER TABLE budget_items
  DROP CONSTRAINT IF EXISTS budget_items_multi_day_rate_override_range;

ALTER TABLE budget_items
  ADD CONSTRAINT budget_items_multi_day_rate_override_range
  CHECK (
    multi_day_rate_override IS NULL
    OR (multi_day_rate_override >= 0 AND multi_day_rate_override <= 1)
  );
