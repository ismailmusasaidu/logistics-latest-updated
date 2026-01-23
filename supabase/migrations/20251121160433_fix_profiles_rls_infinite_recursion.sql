/*
  # Fix Infinite Recursion in Profiles RLS Policies

  1. Changes
    - Drop the problematic admin policies that cause infinite recursion
    - Create new admin policies using a safer approach with security definer function
    
  2. Notes
    - The issue was policies querying the profiles table while evaluating access to profiles
    - Solution: Use a function marked as SECURITY DEFINER to bypass RLS
*/

-- Drop the problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- Create a security definer function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role FROM profiles WHERE id = auth.uid()
  ) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new admin policies using the function
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR is_admin()
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id OR is_admin()
  )
  WITH CHECK (
    auth.uid() = id OR is_admin()
  );

CREATE POLICY "Admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    is_admin()
  );