/*
  # Fix infinite recursion in profiles RLS policies

  1. Changes
    - Drop the "Riders can view customer profiles for assigned orders" policy that causes recursion
    - The policy creates circular reference: profiles -> riders -> profiles
    
  2. Note
    - Riders table already queries profiles for admin check
    - This creates infinite loop when profiles policy queries riders table
    - We'll need a different approach to allow riders to see customer info
*/

DROP POLICY IF EXISTS "Riders can view customer profiles for assigned orders" ON profiles;
