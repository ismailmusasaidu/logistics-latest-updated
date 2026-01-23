/*
  # Fix Admin Profile Policies - Remove Infinite Recursion

  1. Changes
    - Drop the problematic admin policies that cause infinite recursion
    - Keep only the basic user policies that check auth.uid() = id
    
  2. Security
    - Users can view, update, and insert their own profile
    - Admins will need to use service role for viewing all profiles
    
  3. Notes
    - The recursion happens because admin policies query profiles table
      to check if user is admin, which triggers the same policy again
*/

-- Drop admin policies that cause recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
