/*
  # Fix Personnel RLS for Payments Access

  Allow all authenticated users to read all personnel records since payments
  may reference personnel created by other users.
*/

DROP POLICY IF EXISTS "Authenticated users can view all personnel" ON personnel;

CREATE POLICY "Authenticated users can view all personnel"
  ON personnel FOR SELECT
  TO authenticated
  USING (true);
