/*
  # Add warehouse role to users table
  
  1. Changes
    - Drop existing role check constraint
    - Add new role check constraint that includes 'warehouse' role
  
  2. Notes
    - This allows users to have the 'warehouse' role in addition to existing roles
    - Warehouse users have minimal access level for viewing and confirming specifications
*/

-- Drop the existing constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint with warehouse role
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role = ANY (ARRAY['superuser'::text, 'admin'::text, 'clerk'::text, 'staff'::text, 'warehouse'::text]));
