/*
  # Add 'Отменено' status to events table constraint

  1. Changes
    - Drop existing `events_status_check` constraint
    - Add new constraint with 'Отменено' (Cancelled) status value included
*/

-- Drop existing constraint
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;

-- Add new constraint with all current status values
ALTER TABLE events ADD CONSTRAINT events_status_check 
  CHECK (status IN ('Запрос', 'На рассмотрении', 'Подтверждено', 'Отменено'));
