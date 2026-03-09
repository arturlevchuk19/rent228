/*
  # Update Budget Items for Work and Personnel

  1. Changes to Tables
    - Add `item_type` column to `budget_items` to distinguish between 'equipment' and 'work'
    - Add `work_item_id` column to reference work_items
    - Create junction table `budget_item_personnel` for many-to-many relationship

  2. New Tables
    - `budget_item_personnel`
      - `id` (uuid, primary key)
      - `budget_item_id` (uuid, references budget_items)
      - `personnel_id` (uuid, references personnel)
      - `created_at` (timestamp)

  3. Security
    - Enable RLS on `budget_item_personnel` table
    - Add policies for authenticated users
*/

-- Add new columns to budget_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'item_type'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN item_type text DEFAULT 'equipment' CHECK (item_type IN ('equipment', 'work'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_items' AND column_name = 'work_item_id'
  ) THEN
    ALTER TABLE budget_items ADD COLUMN work_item_id uuid REFERENCES work_items(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create junction table for budget items and personnel
CREATE TABLE IF NOT EXISTS budget_item_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_item_id uuid REFERENCES budget_items(id) ON DELETE CASCADE NOT NULL,
  personnel_id uuid REFERENCES personnel(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(budget_item_id, personnel_id)
);

ALTER TABLE budget_item_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view budget item personnel"
  ON budget_item_personnel FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert budget item personnel"
  ON budget_item_personnel FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete budget item personnel"
  ON budget_item_personnel FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_budget_item_personnel_budget_item ON budget_item_personnel(budget_item_id);
CREATE INDEX IF NOT EXISTS idx_budget_item_personnel_personnel ON budget_item_personnel(personnel_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_work_item ON budget_items(work_item_id);
