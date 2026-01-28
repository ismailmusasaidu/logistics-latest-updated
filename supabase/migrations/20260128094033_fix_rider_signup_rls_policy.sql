/*
  # Fix Rider Signup RLS Policy

  1. Changes
    - Drop the restrictive "Admins can insert riders" policy that blocks rider self-signup
    - The existing "Users can insert own rider data" policy already handles authenticated user inserts
    - This allows new riders to create their own entries during signup

  2. Security
    - Users can only insert rider data for their own user_id (enforced by existing policy)
    - Admins can still manage riders through the "Admins can update riders" policy
*/

-- Drop the admin-only insert policy that conflicts with rider self-signup
DROP POLICY IF EXISTS "Admins can insert riders" ON riders;
