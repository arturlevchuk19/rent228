/*
  # Remove load_in_date and load_out_date from events table

  1. Changes
    - Drop `load_in_date` column from `events` table
    - Drop `load_out_date` column from `events` table
  
  2. Notes
    - These columns are no longer needed as per user requirements
    - Only event_date (the date of the event itself) is required
*/

-- Remove the load dates columns
ALTER TABLE events DROP COLUMN IF EXISTS load_in_date;
ALTER TABLE events DROP COLUMN IF EXISTS load_out_date;
