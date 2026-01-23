/*
  # Add Order Status Timestamps

  1. Changes
    - Add timestamp columns for each order status transition
      - `confirmed_at` - When order is confirmed by admin/system
      - `assigned_at` - When order is assigned to a rider
      - `picked_up_at` - When rider picks up the package
      - `in_transit_at` - When order is marked as in transit
      - `cancelled_at` - When order is cancelled
    
  2. Functions
    - Create trigger function to automatically update timestamps when status changes
    - Ensure backward compatibility with existing orders

  3. Notes
    - All timestamp fields are nullable since orders may not go through all statuses
    - Existing orders will have NULL values for these new fields
    - Future orders will have timestamps automatically populated
*/

-- Add timestamp columns for each status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN confirmed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'assigned_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN assigned_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'picked_up_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN picked_up_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'in_transit_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN in_transit_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN cancelled_at timestamptz;
  END IF;
END $$;

-- Create or replace function to automatically update status timestamps
CREATE OR REPLACE FUNCTION update_order_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the appropriate timestamp based on status change
  IF NEW.status != OLD.status THEN
    CASE NEW.status
      WHEN 'confirmed' THEN
        NEW.confirmed_at = now();
      WHEN 'assigned' THEN
        NEW.assigned_at = now();
      WHEN 'picked_up' THEN
        NEW.picked_up_at = now();
      WHEN 'in_transit' THEN
        NEW.in_transit_at = now();
      WHEN 'delivered' THEN
        NEW.delivered_at = now();
      WHEN 'cancelled' THEN
        NEW.cancelled_at = now();
      ELSE
        -- Do nothing for other statuses
    END CASE;
  END IF;
  
  -- Always update updated_at
  NEW.updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists and recreate it
DROP TRIGGER IF EXISTS trigger_update_order_status_timestamp ON orders;

CREATE TRIGGER trigger_update_order_status_timestamp
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_timestamp();

-- Create index for better query performance on timestamp fields
CREATE INDEX IF NOT EXISTS idx_orders_confirmed_at ON orders(confirmed_at);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_at ON orders(assigned_at);
CREATE INDEX IF NOT EXISTS idx_orders_picked_up_at ON orders(picked_up_at);
CREATE INDEX IF NOT EXISTS idx_orders_in_transit_at ON orders(in_transit_at);
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at ON orders(cancelled_at);