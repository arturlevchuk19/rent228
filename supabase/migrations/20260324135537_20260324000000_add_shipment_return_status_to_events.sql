/*
  # Add shipment and return status fields to events

  ## Changes
  - Adds `equipment_shipped` boolean to track when warehouse confirmed equipment shipment
  - Adds `equipment_shipped_at` timestamp for when shipment was confirmed
  - Adds `equipment_returned` boolean to track when warehouse confirmed equipment return
  - Adds `equipment_returned_at` timestamp for when return was confirmed

  These fields power the truck icons in the events list and the workflow buttons
  inside the warehouse specification modal.
*/

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS equipment_shipped boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS equipment_shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS equipment_returned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS equipment_returned_at timestamptz;
