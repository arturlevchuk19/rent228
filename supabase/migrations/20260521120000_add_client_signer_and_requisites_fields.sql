-- Add signer and requisites fields to clients directory
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS basis_for_action text DEFAULT '',
  ADD COLUMN IF NOT EXISTS unp text DEFAULT '',
  ADD COLUMN IF NOT EXISTS legal_address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS postal_address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_details text DEFAULT '';
