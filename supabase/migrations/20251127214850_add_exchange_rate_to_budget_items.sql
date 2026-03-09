/*
  # Add exchange rate to budget items

  1. Changes
    - Add `exchange_rate` column to budget_items table (курс доллара в BYN)
    - Default value is 3 BYN per USD
  
  2. Notes
    - Exchange rate will be used to convert USD prices to BYN
    - BYN non-cash = (price * exchange_rate * quantity * 1.2) rounded to nearest 5
*/

-- Add exchange_rate column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'exchange_rate'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN exchange_rate decimal(10,2) NOT NULL DEFAULT 3.00 CHECK (exchange_rate > 0);
  END IF;
END $$;
