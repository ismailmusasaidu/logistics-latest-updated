/*
  # Add INSERT Policy for Profiles

  1. Changes
    - Add policy to allow authenticated users to insert their own profile
    
  2. Security
    - Users can only insert a profile with their own user ID
    - Prevents users from creating profiles for other users
*/

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
