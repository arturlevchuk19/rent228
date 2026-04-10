-- Change event_date from date type to text to support partial dates (e.g., 2026-00-00)

-- First, drop the trigger that depends on event_date
DROP TRIGGER IF EXISTS update_payments_month_on_event_date_change_trigger ON events;

-- Alter the column type
ALTER TABLE events 
ALTER COLUMN event_date TYPE TEXT;

-- Re-create the trigger with updated function to handle text dates
CREATE OR REPLACE FUNCTION update_payments_month_on_event_date_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.event_date IS DISTINCT FROM NEW.event_date THEN
    -- Only update if the new date is a valid full date (not partial with 00)
    UPDATE payments
    SET month = date_trunc('month', NEW.event_date::date)::date
    WHERE event_id = NEW.id
      AND NEW.event_date ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_payments_month_on_event_date_change_trigger
  AFTER UPDATE OF event_date ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_month_on_event_date_change();

-- Note: Applications should handle validation of date formats
-- Valid formats: YYYY-MM-DD, YYYY-00-DD, YYYY-MM-00, YYYY-00-00
