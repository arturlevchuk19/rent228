/*
  # Update events status constraint to use Russian values

  1. Changes
    - Drop existing `events_status_check` constraint
    - Add new constraint with Russian status values matching the frontend
    - Event types are managed via the event_types table, no constraint needed
  
  2. Notes
    - Frontend uses Russian values: 'Запрос', 'На рассмотрении', 'Подтверждено'
*/

-- Drop existing constraints
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_event_type_check;

-- Add new constraint with Russian status values
ALTER TABLE events ADD CONSTRAINT events_status_check 
  CHECK (status IN ('Запрос', 'На рассмотрении', 'Подтверждено'));
