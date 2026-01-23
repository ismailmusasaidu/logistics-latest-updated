/*
  # Allow riders to view customer profiles for their assigned orders

  1. Changes
    - Add policy for riders to view customer profiles when they have an assigned order from that customer
    
  2. Security
    - Riders can only view profiles of customers whose orders are assigned to them
    - Admins can already view all profiles via existing policy
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'profiles' 
      AND policyname = 'Riders can view customer profiles for assigned orders'
  ) THEN
    CREATE POLICY "Riders can view customer profiles for assigned orders"
      ON profiles
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM orders o
          JOIN riders r ON r.id = o.rider_id
          WHERE o.customer_id = profiles.id
            AND r.user_id = auth.uid()
        )
      );
  END IF;
END $$;
