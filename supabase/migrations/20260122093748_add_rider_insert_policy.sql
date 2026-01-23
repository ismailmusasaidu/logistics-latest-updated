/*
  # Add Rider Insert Policy

  1. Changes
    - Add policy to allow authenticated users to insert their own rider data
    - This enables rider signup to work properly
    
  2. Security
    - Users can only insert rider data for their own user_id
    - Prevents users from creating rider entries for other users
*/

-- Allow authenticated users to insert their own rider data
CREATE POLICY "Users can insert own rider data"
  ON riders FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
