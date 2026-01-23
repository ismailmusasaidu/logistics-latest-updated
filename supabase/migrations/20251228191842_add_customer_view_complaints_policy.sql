/*
  # Add Customer Policy to View Order Complaints

  1. Changes
    - Add policy to allow customers to view complaints for their own orders
  
  2. Security
    - Customers can only view complaints for orders where they are the customer
    - Maintains data privacy by checking customer_id on the orders table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'order_complaints' 
    AND policyname = 'Customers can view complaints for own orders'
  ) THEN
    CREATE POLICY "Customers can view complaints for own orders"
      ON order_complaints
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM orders
          WHERE orders.id = order_complaints.order_id
          AND orders.customer_id = auth.uid()
        )
      );
  END IF;
END $$;
