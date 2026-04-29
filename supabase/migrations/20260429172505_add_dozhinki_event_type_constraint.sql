/*
  # Add "Дожинки" to events event_type constraint

  1. Changes
    - Recreate `events_event_type_check` with the extended list of event types.
    - Add `Дожинки` to the allowed values to match frontend EVENT_TYPES.
*/

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_event_type_check;

ALTER TABLE events
  ADD CONSTRAINT events_event_type_check
  CHECK (event_type IN ('Концерт', 'Свадьба', 'Семинар', 'Выставка', 'Встреча', 'Фестиваль', 'Дожинки'));
