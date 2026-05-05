-- Remove events_event_type_check constraint
-- Event types are now managed via the event_types table, so the constraint is unnecessary

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_event_type_check;