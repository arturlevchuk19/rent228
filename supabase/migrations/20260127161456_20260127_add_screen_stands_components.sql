/*
  # Add components for stand modification
  
  Add TV stand components to "На стойках" modification
*/

WITH mod_stands AS (
  SELECT em.id FROM equipment_modifications em
  INNER JOIN equipment_items ei ON em.equipment_id = ei.id
  WHERE ei.sku = 'SCREEN-4X2.5' AND em.name = 'На стойках'
  LIMIT 1
),
tv_stand AS (
  SELECT id FROM equipment_items 
  WHERE name LIKE '%Основание%TV%' OR name LIKE '%стойк%'
  LIMIT 1
)
INSERT INTO modification_components (modification_id, component_equipment_id, quantity)
SELECT ms.id, ts.id, 4
FROM mod_stands ms, tv_stand ts
WHERE NOT EXISTS (
  SELECT 1 FROM modification_components
  WHERE modification_id = ms.id AND component_equipment_id = ts.id
)
ON CONFLICT DO NOTHING;
