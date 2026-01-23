/*
  # Enable Realtime for Order Complaints

  1. Changes
    - Enable realtime updates for the order_complaints table
    - This allows customers to see new complaints immediately without refreshing
  
  2. Security
    - Realtime respects existing RLS policies
    - Only users with SELECT permissions will receive updates
*/

ALTER PUBLICATION supabase_realtime ADD TABLE order_complaints;
