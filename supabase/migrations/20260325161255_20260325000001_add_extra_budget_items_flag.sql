/*
  # Add extra (dobor) flag to budget_items and return_picked field

  1. Changes to budget_items
    - `is_extra` (boolean, default false) — marks items added in "Добор" tab (after shipment)
    - `return_picked` (boolean, default false) — marks items confirmed as returned by warehouse

  2. Changes to events
    - No new columns needed; equipment_shipped and equipment_returned already exist

  3. Notes
    - is_extra = true means item was added AFTER shipment was confirmed (extra load)
    - return_picked tracks whether each item was checked off during return/unload
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'is_extra'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN is_extra boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'return_picked'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN return_picked boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_specification_cables' AND column_name = 'return_picked'
  ) THEN
    ALTER TABLE warehouse_specification_cables ADD COLUMN return_picked boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_specification_connectors' AND column_name = 'return_picked'
  ) THEN
    ALTER TABLE warehouse_specification_connectors ADD COLUMN return_picked boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_specification_other' AND column_name = 'return_picked'
  ) THEN
    ALTER TABLE warehouse_specification_other ADD COLUMN return_picked boolean NOT NULL DEFAULT false;
  END IF;
END $$;
