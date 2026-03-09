/*
  # Add suspension modification to screen

  1. Add second modification
    - "В подвесе" (suspended)
*/

WITH screen AS (
  SELECT id FROM equipment_items WHERE sku = 'SCREEN-4X2.5' LIMIT 1
)
INSERT INTO equipment_modifications (equipment_id, name, description, sort_order)
SELECT screen.id, 'В подвесе', 'Экран подвешен на ферме', 1 FROM screen
WHERE NOT EXISTS (
  SELECT 1 FROM equipment_modifications 
  WHERE equipment_id = screen.id AND name = 'В подвесе'
)
ON CONFLICT DO NOTHING;
