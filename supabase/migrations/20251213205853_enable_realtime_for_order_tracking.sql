-- # Enable Realtime for Order Tracking Table
--
-- 1. Changes
--   - Enable realtime replication for the order_tracking table
--   - This allows clients to subscribe to order tracking updates in real-time
--   
-- 2. Notes
--   - Required for riders and customers to see live tracking updates

ALTER PUBLICATION supabase_realtime ADD TABLE order_tracking;