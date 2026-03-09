/*
  # Fix budget_items to reference equipment_items table

  1. Changes
    - Drop existing foreign key constraint on equipment_id
    - Add new foreign key constraint referencing equipment_items table
  
  2. Notes
    - The actual equipment table is named equipment_items, not equipment
*/

-- Drop old constraint if exists
ALTER TABLE budget_items DROP CONSTRAINT IF EXISTS budget_items_equipment_id_fkey;

-- Add new constraint referencing the correct table
ALTER TABLE budget_items 
  ADD CONSTRAINT budget_items_equipment_id_fkey 
  FOREIGN KEY (equipment_id) 
  REFERENCES equipment_items(id) 
  ON DELETE RESTRICT;
