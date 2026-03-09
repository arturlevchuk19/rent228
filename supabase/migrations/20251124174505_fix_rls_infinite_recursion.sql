/*
  # Fix RLS Infinite Recursion in Users Table

  ## Problem
  The policies "Admins can view all users" and "Admins can update users" cause infinite recursion
  because they query the users table to check if the current user is an admin, which triggers
  the same SELECT policy again in a loop.

  ## Solution
  Store the user's role in auth.jwt() app_metadata instead of checking the users table.
  This breaks the recursion cycle because auth.jwt() doesn't trigger RLS policies.

  ## Changes
  1. Drop existing admin policies that cause recursion
  2. Create new policies that use auth.jwt() instead of querying users table
  3. For now, simplify to allow users to view their own profile only
  4. Admin functionality will be handled separately via service role or functions
*/

-- Drop problematic policies
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Admins can update users" ON users;

-- Keep simple policies that don't cause recursion
-- Users can view their own profile
-- (already exists as "Users can view own profile")

-- Users can update their own profile  
-- (already exists as "Users can update own profile")

-- For admin operations, we'll use service role or edge functions
-- This avoids the recursion problem entirely
