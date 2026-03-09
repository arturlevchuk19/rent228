/*
  # Add specification confirmation fields to events

  1. Add fields to events table:
    - `specification_confirmed` (boolean)
    - `specification_confirmed_at` (timestamptz)
    - `specification_confirmed_by` (uuid, references auth.users)
*/

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS specification_confirmed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS specification_confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS specification_confirmed_by uuid REFERENCES auth.users(id);
