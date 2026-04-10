-- Change event_date from date type to text to support partial dates (e.g., 2026-00-00)

-- First, alter the column type
ALTER TABLE events 
ALTER COLUMN event_date TYPE TEXT;

-- Update existing dates to proper format if needed
-- (PostgreSQL date type was storing dates as YYYY-MM-DD, which is already our target format)

-- Note: Applications should handle validation of date formats
-- Valid formats: YYYY-MM-DD, YYYY-00-DD, YYYY-MM-00, YYYY-00-00
