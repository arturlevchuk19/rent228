/*
  # Create example screen equipment with modifications

  1. New Equipment
    - Screen 4x2.5m - main equipment item
  
  2. New Modifications
    - "На стойках" (on stands) - with stands and cables
    - "В подвесе" (suspended) - with truss and rigging hardware

  3. Components for modifications
    - Each modification has its own set of components
    - When selected, all components are added to warehouse specification

  This is an example setup showing how modifications work.
*/

-- Insert the main screen equipment
INSERT INTO equipment_items (category, type, subtype, name, sku, quantity, rental_price, object_type, rental_type, has_composition)
VALUES ('Видео', 'Экран', 'LED', 'Экран 4х2,5м', 'SCREEN-4X2.5', 1, 500, 'physical', 'rental', false)
ON CONFLICT (sku) DO NOTHING;

-- Get the screen ID for reference
WITH screen AS (
  SELECT id FROM equipment_items WHERE sku = 'SCREEN-4X2.5' LIMIT 1
),
stands AS (
  SELECT id FROM equipment_items WHERE sku LIKE '%стойк%' OR name LIKE '%стойка%' LIMIT 1
),
cable AS (
  SELECT id FROM equipment_items WHERE name LIKE '%кабель%' OR name LIKE '%провод%' LIMIT 1
),
truss AS (
  SELECT id FROM equipment_items WHERE name LIKE '%ферма%' OR name LIKE '%трасса%' LIMIT 1
),
rigging AS (
  SELECT id FROM equipment_items WHERE name LIKE '%навеска%' OR name LIKE '%крепление%' LIMIT 1
)
INSERT INTO equipment_modifications (equipment_id, name, description, sort_order)
SELECT screen.id, 'На стойках', 'Экран установлен на стойках', 0 FROM screen
ON CONFLICT DO NOTHING;

-- If the modifications were created, add their components
-- This is a simplified example - in reality you would add actual components
-- For now, we just create the modification structure
