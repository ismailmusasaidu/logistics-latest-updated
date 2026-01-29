/*
  # Add trigger to update rider total_deliveries

  1. Changes
    - Create function to update rider's total_deliveries count when order is delivered
    - Add trigger on orders table to call this function
    - Backfill existing delivered orders to update current counts
    
  2. Purpose
    - Automatically increment total_deliveries when order status changes to 'delivered'
    - Ensure rider statistics are accurate and up-to-date
*/

-- Function to update rider's total deliveries count
CREATE OR REPLACE FUNCTION update_rider_total_deliveries()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if order status changed to 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status != 'delivered') THEN
    -- Increment total_deliveries for the rider
    IF NEW.rider_id IS NOT NULL THEN
      UPDATE riders
      SET total_deliveries = COALESCE(total_deliveries, 0) + 1
      WHERE id = NEW.rider_id;
    END IF;
    
    -- Also check assigned_rider_id if different
    IF NEW.assigned_rider_id IS NOT NULL AND NEW.assigned_rider_id != NEW.rider_id THEN
      UPDATE riders
      SET total_deliveries = COALESCE(total_deliveries, 0) + 1
      WHERE id = NEW.assigned_rider_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS update_rider_deliveries_trigger ON orders;
CREATE TRIGGER update_rider_deliveries_trigger
  AFTER INSERT OR UPDATE OF status
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_rider_total_deliveries();

-- Backfill existing delivered orders to update current counts
UPDATE riders
SET total_deliveries = (
  SELECT COUNT(*)
  FROM orders
  WHERE status = 'delivered'
  AND (orders.rider_id = riders.id OR orders.assigned_rider_id = riders.id)
)
WHERE EXISTS (
  SELECT 1
  FROM orders
  WHERE status = 'delivered'
  AND (orders.rider_id = riders.id OR orders.assigned_rider_id = riders.id)
);
