/*
  # Create warehouse specification budget items snapshot table

  1. New table `warehouse_specification_budget_items`
    - Stores a decoupled copy of equipment lines from `budget_items` for warehouse workflow.
    - Keeps optional reference to the source estimate line via `source_budget_item_id`.
    - Supports independent edits (quantity, notes, delete, picked/return_picked).
*/

CREATE TABLE IF NOT EXISTS warehouse_specification_budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_budget_item_id uuid REFERENCES budget_items(id) ON DELETE SET NULL,
  parent_budget_item_id uuid REFERENCES warehouse_specification_budget_items(id) ON DELETE CASCADE,
  item_type text NOT NULL DEFAULT 'equipment' CHECK (item_type IN ('equipment', 'work')),
  equipment_id uuid REFERENCES equipment_items(id) ON DELETE SET NULL,
  modification_id uuid REFERENCES equipment_modifications(id) ON DELETE SET NULL,
  work_item_id uuid REFERENCES work_items(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  price numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  exchange_rate numeric(10,4) NOT NULL DEFAULT 1,
  multi_day_rate_override numeric(5,2),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  picked boolean NOT NULL DEFAULT false,
  return_picked boolean NOT NULL DEFAULT false,
  is_extra boolean NOT NULL DEFAULT false,
  name text,
  sku text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ws_budget_items_event_id
  ON warehouse_specification_budget_items(event_id);

CREATE INDEX IF NOT EXISTS idx_ws_budget_items_source_id
  ON warehouse_specification_budget_items(source_budget_item_id);

CREATE INDEX IF NOT EXISTS idx_ws_budget_items_parent_id
  ON warehouse_specification_budget_items(parent_budget_item_id);

ALTER TABLE warehouse_specification_budget_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'warehouse_specification_budget_items'
      AND policyname = 'Users can view warehouse specification budget items'
  ) THEN
    DROP POLICY "Users can view warehouse specification budget items" ON warehouse_specification_budget_items;
  END IF;
END $$;
CREATE POLICY "Users can view warehouse specification budget items"
  ON warehouse_specification_budget_items FOR SELECT
  TO authenticated
  USING (true);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'warehouse_specification_budget_items'
      AND policyname = 'Users can insert warehouse specification budget items'
  ) THEN
    DROP POLICY "Users can insert warehouse specification budget items" ON warehouse_specification_budget_items;
  END IF;
END $$;
CREATE POLICY "Users can insert warehouse specification budget items"
  ON warehouse_specification_budget_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'warehouse_specification_budget_items'
      AND policyname = 'Users can update warehouse specification budget items'
  ) THEN
    DROP POLICY "Users can update warehouse specification budget items" ON warehouse_specification_budget_items;
  END IF;
END $$;
CREATE POLICY "Users can update warehouse specification budget items"
  ON warehouse_specification_budget_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'warehouse_specification_budget_items'
      AND policyname = 'Users can delete warehouse specification budget items'
  ) THEN
    DROP POLICY "Users can delete warehouse specification budget items" ON warehouse_specification_budget_items;
  END IF;
END $$;
CREATE POLICY "Users can delete warehouse specification budget items"
  ON warehouse_specification_budget_items FOR DELETE
  TO authenticated
  USING (true);
