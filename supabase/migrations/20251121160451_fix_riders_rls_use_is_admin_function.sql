/*
  # Fix Riders RLS Policies to Use is_admin() Function

  1. Changes
    - Drop existing admin policies for riders that cause potential recursion
    - Recreate them using the is_admin() security definer function
    
  2. Security
    - Only admins and the rider themselves can access rider data
*/

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admins can view all riders" ON riders;
DROP POLICY IF EXISTS "Admins can insert riders" ON riders;
DROP POLICY IF EXISTS "Admins can update riders" ON riders;
DROP POLICY IF EXISTS "Admins can delete riders" ON riders;

-- Recreate with is_admin() function
CREATE POLICY "Admins can view all riders"
  ON riders
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR is_admin()
  );

CREATE POLICY "Admins can insert riders"
  ON riders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin()
  );

CREATE POLICY "Admins can update riders"
  ON riders
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR is_admin()
  )
  WITH CHECK (
    user_id = auth.uid() OR is_admin()
  );

CREATE POLICY "Admins can delete riders"
  ON riders
  FOR DELETE
  TO authenticated
  USING (
    is_admin()
  );