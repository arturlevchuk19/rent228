/*
  # Drop connector_category from warehouse_specification_connectors

  connector_type already stores type/category; keep connector_item as separate element field.
*/

UPDATE warehouse_specification_connectors
SET connector_type = split_part(connector_type, '::', 1)
WHERE position('::' in connector_type) > 0;

ALTER TABLE warehouse_specification_connectors
  DROP COLUMN IF EXISTS connector_category;
