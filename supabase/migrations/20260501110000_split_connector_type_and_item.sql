/*
  # Split connector type into category and item fields

  1. Schema
    - Add `connector_category` (text) to `warehouse_specification_connectors`
    - Add `connector_item` (text) to `warehouse_specification_connectors`

  2. Data migration
    - Backfill new fields by splitting legacy `connector_type` by `::`
    - Keep `connector_type` for backward compatibility

  3. Indexes
    - Add indexes for category and item fields
*/

ALTER TABLE warehouse_specification_connectors
  ADD COLUMN IF NOT EXISTS connector_category text,
  ADD COLUMN IF NOT EXISTS connector_item text;

UPDATE warehouse_specification_connectors
SET
  connector_category = CASE
    WHEN position('::' in connector_type) > 0 THEN split_part(connector_type, '::', 1)
    ELSE null
  END,
  connector_item = CASE
    WHEN position('::' in connector_type) > 0 THEN substring(connector_type from position('::' in connector_type) + 2)
    ELSE connector_type
  END
WHERE connector_item IS NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_connectors_category
  ON warehouse_specification_connectors(connector_category);

CREATE INDEX IF NOT EXISTS idx_warehouse_connectors_item
  ON warehouse_specification_connectors(connector_item);
