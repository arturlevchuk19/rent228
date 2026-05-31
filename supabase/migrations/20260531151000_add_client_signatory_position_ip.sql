-- Add nominative-case signatory position field to clients directory
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS signatory_position_ip text DEFAULT '';
