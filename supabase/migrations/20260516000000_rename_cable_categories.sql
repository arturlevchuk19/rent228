-- Rename cable categories in warehouse_specification_cables
UPDATE warehouse_specification_cables SET cable_type = 'Кабель 16А 5P' WHERE cable_type = 'Кабель 16А';
UPDATE warehouse_specification_cables SET cable_type = 'Кабель 32А 5P' WHERE cable_type = 'Кабель 32А';
UPDATE warehouse_specification_cables SET cable_type = 'Кабель 32А 4P' WHERE cable_type = 'Лебёдочные';
