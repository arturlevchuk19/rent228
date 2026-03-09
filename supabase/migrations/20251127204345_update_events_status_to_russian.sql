/*
  # Update events status constraint to use Russian values

  1. Changes
    - Drop existing `events_status_check` constraint
    - Add new constraint with Russian status values matching the frontend
    - Update event_type constraint to match Russian values from frontend
  
  2. Notes
    - Frontend uses Russian values: 'Запрос', 'На рассмотрении', 'Подтверждено'
    - Frontend uses Russian event types: 'Концерт', 'Свадьба', 'Семинар', 'Выставка', 'Встреча', 'Фестиваль'
*/

-- Drop existing constraints
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_event_type_check;

-- Add new constraint with Russian status values
ALTER TABLE events ADD CONSTRAINT events_status_check 
  CHECK (status IN ('Запрос', 'На рассмотрении', 'Подтверждено'));

-- Add new constraint with Russian event type values
ALTER TABLE events ADD CONSTRAINT events_event_type_check 
  CHECK (event_type IN ('Концерт', 'Свадьба', 'Семинар', 'Выставка', 'Встреча', 'Фестиваль'));
