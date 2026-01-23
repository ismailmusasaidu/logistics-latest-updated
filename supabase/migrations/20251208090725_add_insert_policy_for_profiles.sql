/*
  # Add INSERT policy for profiles table

  1. Changes
    - Add INSERT policy allowing users to create their own profile
    - This enables the trigger to create profiles for new signups
    
  2. Security
    - Users can only insert their own profile (id must match auth.uid())
*/

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);