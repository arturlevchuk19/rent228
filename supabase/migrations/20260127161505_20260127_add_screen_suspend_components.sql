/*
  # Add components for suspension modification
  
  Add truss and rigging components to "В подвесе" modification
*/

WITH mod_suspend AS (
  SELECT em.id FROM equipment_modifications em
  INNER JOIN equipment_items ei ON em.equipment_id = ei.id
  WHERE ei.sku = 'SCREEN-4X2.5' AND em.name = 'В подвесе'
  LIMIT 1
),
truss AS (
  SELECT id FROM equipment_items 
  WHERE category = 'Сцена' AND name LIKE '%Ферма%K4%'
  LIMIT 1
),
rigging AS (
  SELECT id FROM equipment_items 
  WHERE category = 'Сцена' AND name LIKE '%Навершие%'
  LIMIT 1
)
INSERT INTO modification_components (modification_id, component_equipment_id, quantity)
SELECT ms.id, t.id, 2
FROM mod_suspend ms, truss t
WHERE NOT EXISTS (
  SELECT 1 FROM modification_components
  WHERE modification_id = ms.id AND component_equipment_id = t.id
)

UNION ALL

SELECT ms.id, r.id, 4
FROM mod_suspend ms, rigging r
WHERE NOT EXISTS (
  SELECT 1 FROM modification_components
  WHERE modification_id = ms.id AND component_equipment_id = r.id
);
