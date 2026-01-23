/*
  # Add Bulk Delivery Support

  ## Overview
  This migration adds support for bulk deliveries, allowing customers to create multiple delivery orders at once with potential discounts.

  ## Changes
  
  1. New Table: `bulk_orders`
    - `id` (uuid, primary key): Unique identifier
    - `customer_id` (uuid): Reference to customer who created the bulk order
    - `bulk_order_number` (text): Human-readable bulk order number
    - `total_orders` (integer): Number of orders in the bulk
    - `total_fee` (numeric): Total delivery fee for all orders
    - `discount_percentage` (numeric): Discount applied to bulk order
    - `final_fee` (numeric): Final fee after discount
    - `status` (text): Overall status of bulk order
    - `notes` (text): Additional notes
    - `created_at` (timestamp): Creation timestamp
    - `updated_at` (timestamp): Last update timestamp

  2. Update `orders` table
    - Add `bulk_order_id` (uuid, nullable): Link to bulk order if part of one

  3. Security
    - Enable RLS on bulk_orders table
    - Customers can view/create their own bulk orders
    - Admins can view all bulk orders
    - Riders can view bulk orders for their assigned deliveries

  ## Important Notes
  - Bulk order discount increases with number of orders (5% for 3-5 orders, 10% for 6-10, 15% for 11+)
  - All orders in a bulk share the same bulk_order_id
*/

-- Create bulk_orders table
CREATE TABLE IF NOT EXISTS bulk_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bulk_order_number text UNIQUE NOT NULL,
  total_orders integer NOT NULL DEFAULT 0,
  total_fee numeric(10,2) NOT NULL DEFAULT 0,
  discount_percentage numeric(5,2) NOT NULL DEFAULT 0,
  final_fee numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add bulk_order_id to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'bulk_order_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN bulk_order_id uuid REFERENCES bulk_orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for faster bulk order queries
CREATE INDEX IF NOT EXISTS idx_orders_bulk_order_id ON orders(bulk_order_id);
CREATE INDEX IF NOT EXISTS idx_bulk_orders_customer_id ON bulk_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_bulk_orders_status ON bulk_orders(status);

-- Function to generate bulk order number
CREATE OR REPLACE FUNCTION generate_bulk_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  number_exists BOOLEAN;
BEGIN
  LOOP
    new_number := 'BULK-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    SELECT EXISTS(SELECT 1 FROM bulk_orders WHERE bulk_order_number = new_number) INTO number_exists;
    EXIT WHEN NOT number_exists;
  END LOOP;
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate bulk order number
CREATE OR REPLACE FUNCTION set_bulk_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bulk_order_number IS NULL OR NEW.bulk_order_number = '' THEN
    NEW.bulk_order_number := generate_bulk_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_bulk_order_number
  BEFORE INSERT ON bulk_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_bulk_order_number();

-- Trigger to update bulk_orders.updated_at
CREATE OR REPLACE FUNCTION update_bulk_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bulk_order_timestamp
  BEFORE UPDATE ON bulk_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_bulk_order_timestamp();

-- Enable RLS on bulk_orders
ALTER TABLE bulk_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bulk_orders

-- Customers can view their own bulk orders
CREATE POLICY "Customers can view own bulk orders"
  ON bulk_orders FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

-- Customers can create their own bulk orders
CREATE POLICY "Customers can create own bulk orders"
  ON bulk_orders FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- Customers can update their own bulk orders
CREATE POLICY "Customers can update own bulk orders"
  ON bulk_orders FOR UPDATE
  TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- Admins can view all bulk orders
CREATE POLICY "Admins can view all bulk orders"
  ON bulk_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update all bulk orders
CREATE POLICY "Admins can update all bulk orders"
  ON bulk_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Riders can view bulk orders for their assigned deliveries
CREATE POLICY "Riders can view bulk orders for assigned deliveries"
  ON bulk_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      JOIN riders ON riders.user_id = auth.uid()
      WHERE orders.bulk_order_id = bulk_orders.id
      AND orders.rider_id = riders.id
    )
  );