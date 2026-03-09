/*
  # Create Work Items Schema

  1. New Tables
    - `work_items`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text) - Наименование работы
      - `unit` (text) - Единица измерения
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `work_items` table
    - Add policies for authenticated users to manage work items
*/

CREATE TABLE IF NOT EXISTS work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  unit text DEFAULT 'шт',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own work items"
  ON work_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own work items"
  ON work_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own work items"
  ON work_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own work items"
  ON work_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_work_items_user_id ON work_items(user_id);
