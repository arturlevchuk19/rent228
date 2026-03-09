/*
  # Add warehouse specification other items table

  1. Create warehouse_specification_other table
    - For storing toolkit, clamps, straps, etc.
  
  2. Tables created:
    - `warehouse_specification_other`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key)
      - `category` (text) - Инструменталка, Clamp, Ремешки
      - `item_type` (text) - specific item name
      - `quantity` (integer)
      - `notes` (text)
      - `picked` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  3. Security
    - Enable RLS on `warehouse_specification_other`
    - Add policies for authenticated users to manage items
*/

CREATE TABLE IF NOT EXISTS warehouse_specification_other (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category text NOT NULL,
  item_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  notes text DEFAULT '',
  picked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE warehouse_specification_other ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage other items"
  ON warehouse_specification_other FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_warehouse_other_event_id ON warehouse_specification_other(event_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_other_category ON warehouse_specification_other(category);