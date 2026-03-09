/*
  # Add Unique Constraint to Work Items

  1. Changes
    - Add unique constraint on (name, user_id) to prevent duplicate work items
    - This allows upsert operations to work correctly during CSV imports
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'work_items_name_user_id_key'
  ) THEN
    ALTER TABLE work_items ADD CONSTRAINT work_items_name_user_id_key UNIQUE (name, user_id);
  END IF;
END $$;
