/*
  # Allow Customers to View Zones

  ## Changes
    - Add SELECT policy for customers to view active zones
    - This enables zone matching to work during order creation

  ## Security
    - Customers can only view zones, not modify them
    - Required for automatic rider assignment to work
*/

CREATE POLICY "Customers can view all zones"
  ON zones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'customer'
    )
  );
