/*
  # Add Admin Policies for Profiles and Riders Management

  1. Changes
    - Add policy for admins to view all profiles
    - Add policy for admins to update all profiles
    - Add policy for admins to delete profiles
    
  2. Security
    - Only users with role 'admin' can perform these actions
    - Regular users can still only view/update their own profiles
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Admins can view all profiles'
  ) THEN
    CREATE POLICY "Admins can view all profiles"
      ON profiles
      FOR SELECT
      TO authenticated
      USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Admins can update all profiles'
  ) THEN
    CREATE POLICY "Admins can update all profiles"
      ON profiles
      FOR UPDATE
      TO authenticated
      USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
      )
      WITH CHECK (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Admins can delete profiles'
  ) THEN
    CREATE POLICY "Admins can delete profiles"
      ON profiles
      FOR DELETE
      TO authenticated
      USING (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
      );
  END IF;
END $$;