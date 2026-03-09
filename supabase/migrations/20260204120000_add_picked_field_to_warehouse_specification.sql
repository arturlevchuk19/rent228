/*
  # Add picked field to warehouse specification cables and connectors

  1. Add picked boolean field to warehouse_specification_cables table
  2. Add picked boolean field to warehouse_specification_connectors table
  3. Set default value to false for existing records
*/

-- Add picked field to warehouse_specification_cables table
ALTER TABLE warehouse_specification_cables 
ADD COLUMN IF NOT EXISTS picked boolean DEFAULT false;

-- Add picked field to warehouse_specification_connectors table  
ALTER TABLE warehouse_specification_connectors
ADD COLUMN IF NOT EXISTS picked boolean DEFAULT false;

-- Update existing records to have picked = false
UPDATE warehouse_specification_cables SET picked = false WHERE picked IS NULL;
UPDATE warehouse_specification_connectors SET picked = false WHERE picked IS NULL;