/*
  # Fix connector reorder migration

  Makes connector reorder idempotent and resilient to partial/failed previous attempts.
*/

DROP TABLE IF EXISTS warehouse_specification_connectors_tmp;

CREATE TABLE warehouse_specification_connectors_tmp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  connector_type text NOT NULL,
  connector_item text,
  connector_category text,
  quantity int4 NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  picked boolean NOT NULL DEFAULT false,
  return_picked boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO warehouse_specification_connectors_tmp (
  id, event_id, connector_type, connector_item, connector_category,
  quantity, notes, picked, return_picked, created_at, updated_at
)
SELECT
  id,
  event_id,
  connector_type,
  COALESCE(connector_item, CASE WHEN position('::' in connector_type) > 0 THEN substring(connector_type from position('::' in connector_type) + 2) ELSE connector_type END),
  COALESCE(connector_category, CASE WHEN position('::' in connector_type) > 0 THEN split_part(connector_type, '::', 1) ELSE null END),
  quantity,
  notes,
  COALESCE(picked, false),
  COALESCE(return_picked, false),
  created_at,
  updated_at
FROM warehouse_specification_connectors;

DROP TABLE warehouse_specification_connectors;
ALTER TABLE warehouse_specification_connectors_tmp RENAME TO warehouse_specification_connectors;

CREATE INDEX IF NOT EXISTS idx_warehouse_connectors_event ON warehouse_specification_connectors(event_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_connectors_type ON warehouse_specification_connectors(connector_type);
CREATE INDEX IF NOT EXISTS idx_warehouse_connectors_category ON warehouse_specification_connectors(connector_category);
CREATE INDEX IF NOT EXISTS idx_warehouse_connectors_item ON warehouse_specification_connectors(connector_item);

ALTER TABLE warehouse_specification_connectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view all connectors" ON warehouse_specification_connectors;
DROP POLICY IF EXISTS "Authenticated users can insert connectors" ON warehouse_specification_connectors;
DROP POLICY IF EXISTS "Authenticated users can update connectors" ON warehouse_specification_connectors;
DROP POLICY IF EXISTS "Authenticated users can delete connectors" ON warehouse_specification_connectors;

CREATE POLICY "Authenticated users can view all connectors"
  ON warehouse_specification_connectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert connectors"
  ON warehouse_specification_connectors FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update connectors"
  ON warehouse_specification_connectors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete connectors"
  ON warehouse_specification_connectors FOR DELETE TO authenticated USING (true);
