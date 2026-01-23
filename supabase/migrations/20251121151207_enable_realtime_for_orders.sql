/*
  # Enable Realtime for Orders Table

  1. Changes
    - Enable realtime replication for the orders table
    - This allows clients to subscribe to changes on orders in real-time
    
  2. Notes
    - Required for the customer dashboard to automatically update when admins modify orders
*/

ALTER PUBLICATION supabase_realtime ADD TABLE orders;