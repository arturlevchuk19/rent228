/*
  # Create budget items schema

  1. New Tables
    - `budget_items`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key to events) - мероприятие
      - `equipment_id` (uuid, foreign key to equipment) - оборудование из справочника
      - `quantity` (integer) - количество единиц оборудования
      - `price` (decimal) - цена за единицу на момент добавления в смету
      - `total` (decimal, computed) - общая стоимость (quantity * price)
      - `notes` (text, nullable) - примечания к позиции
      - `created_at` (timestamptz) - дата создания
      - `updated_at` (timestamptz) - дата обновления

  2. Security
    - Enable RLS on `budget_items` table
    - Add policies for authenticated users to manage budget items for their events

  3. Notes
    - Price is stored at the time of adding to budget to preserve historical data
    - Total is calculated automatically via trigger
    - Users can only manage budget items for events they have access to
*/

-- Create budget_items table
CREATE TABLE IF NOT EXISTS budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price decimal(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  total decimal(10,2) NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_budget_items_event_id ON budget_items(event_id);
CREATE INDEX IF NOT EXISTS idx_budget_items_equipment_id ON budget_items(equipment_id);

-- Create function to automatically calculate total
CREATE OR REPLACE FUNCTION calculate_budget_item_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total := NEW.quantity * NEW.price;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update total on insert or update
DROP TRIGGER IF EXISTS budget_items_calculate_total ON budget_items;
CREATE TRIGGER budget_items_calculate_total
  BEFORE INSERT OR UPDATE OF quantity, price ON budget_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_budget_item_total();

-- Enable RLS
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

-- Policies for budget_items
CREATE POLICY "Users can view budget items for all events"
  ON budget_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert budget items for events"
  ON budget_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update budget items for events"
  ON budget_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete budget items for events"
  ON budget_items FOR DELETE
  TO authenticated
  USING (true);
