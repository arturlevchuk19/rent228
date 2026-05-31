-- Ensure client signatory initials field exists for organization directory forms and contracts
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS signatory_initials text DEFAULT '';
