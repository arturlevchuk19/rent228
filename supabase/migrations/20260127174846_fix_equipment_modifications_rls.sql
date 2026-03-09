/*
  # Fix RLS policies for equipment modifications

  1. Changes
    - Create a security definer function to check user roles safely
    - Update RLS policies for equipment_modifications to use the function
    - Update RLS policies for modification_components to use the function

  2. Security
    - Function runs with elevated privileges to bypass RLS on users table
    - Policies still enforce admin-only access for INSERT/UPDATE/DELETE operations
*/

-- Create a security definer function to check if the current user is admin
CREATE OR REPLACE FUNCTION is_admin_or_superuser()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superuser')
  );
END;
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Admin can manage equipment modifications" ON equipment_modifications;
DROP POLICY IF EXISTS "Admin can update equipment modifications" ON equipment_modifications;
DROP POLICY IF EXISTS "Admin can delete equipment modifications" ON equipment_modifications;
DROP POLICY IF EXISTS "Admin can manage modification components" ON modification_components;
DROP POLICY IF EXISTS "Admin can update modification components" ON modification_components;
DROP POLICY IF EXISTS "Admin can delete modification components" ON modification_components;

-- Recreate policies using the security definer function
CREATE POLICY "Admin can manage equipment modifications"
  ON equipment_modifications FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_superuser());

CREATE POLICY "Admin can update equipment modifications"
  ON equipment_modifications FOR UPDATE
  TO authenticated
  USING (is_admin_or_superuser());

CREATE POLICY "Admin can delete equipment modifications"
  ON equipment_modifications FOR DELETE
  TO authenticated
  USING (is_admin_or_superuser());

CREATE POLICY "Admin can manage modification components"
  ON modification_components FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_superuser());

CREATE POLICY "Admin can update modification components"
  ON modification_components FOR UPDATE
  TO authenticated
  USING (is_admin_or_superuser());

CREATE POLICY "Admin can delete modification components"
  ON modification_components FOR DELETE
  TO authenticated
  USING (is_admin_or_superuser());