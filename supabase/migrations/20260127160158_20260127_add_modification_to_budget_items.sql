/*
  # Add modification_id to budget_items

  1. Changes
    - `budget_items.modification_id` (uuid, nullable) - references equipment_modifications
    - When equipment item has modifications, user must select one
    - When modification is selected, its components are added to warehouse specification

  2. Relationships
    - budget_items.modification_id references equipment_modifications.id
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'modification_id'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN modification_id uuid REFERENCES equipment_modifications(id) ON DELETE SET NULL;
    CREATE INDEX budget_items_modification_id_idx ON budget_items(modification_id);
  END IF;
END $$;
