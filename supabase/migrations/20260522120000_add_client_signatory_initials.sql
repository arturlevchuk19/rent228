-- Add signatory_initials field to clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS signatory_initials text DEFAULT '';
