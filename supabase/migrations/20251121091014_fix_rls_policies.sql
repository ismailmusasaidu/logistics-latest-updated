/*
  # Fix RLS Policies - Remove Infinite Recursion

  1. Changes
    - Drop the problematic "Admins can view all profiles" policy that causes infinite recursion
    - Keep simple policies that only check auth.uid() = id
    
  2. Security
    - Users can only view and update their own profile
    - Admin functionality will need to use service role or a different approach
*/

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Users can only view their own profile
-- This policy already exists, just ensuring it's the only SELECT policy
