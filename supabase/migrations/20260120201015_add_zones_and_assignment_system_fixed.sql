/*
  # Zone-Based Automatic Rider Assignment System

  ## Overview
  This migration adds a comprehensive zone-based rider assignment system with automatic dispatch capabilities.

  ## 1. New Tables
    - `zones`
      - `id` (uuid, primary key)
      - `name` (text) - Zone name (e.g., "Downtown", "North Side")
      - `description` (text) - Optional description
      - `coordinates` (jsonb) - GeoJSON polygon defining zone boundaries
      - `is_active` (boolean) - Whether zone is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  ## 2. Orders Table Updates
    - `pickup_zone_id` (uuid) - References zones table
    - `assigned_rider_id` (uuid) - Rider assigned by auto-dispatch
    - `assignment_status` (text) - pending, assigned, accepted, rejected
    - `assigned_at` (timestamptz) - When rider was assigned
    - `assignment_timeout_at` (timestamptz) - When assignment expires (30 seconds)

  ## 3. Riders Table Updates
    - `zone_id` (uuid) - References zones table
    - `active_orders` (integer) - Count of active orders
    - Update status enum to use 'online' and 'offline'

  ## 4. Security
    - Enable RLS on zones table
    - Add policies for admins to manage zones
    - Add policies for riders to view zones
    - Update order policies to handle assignment fields

  ## 5. Indexes
    - Add index on orders.assigned_rider_id
    - Add index on orders.assignment_status
    - Add index on orders.pickup_zone_id
    - Add index on riders.zone_id
    - Add index on riders.active_orders
*/

-- Create zones table
CREATE TABLE IF NOT EXISTS zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  coordinates jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE zones ENABLE ROW LEVEL SECURITY;

-- Drop existing status constraint on riders
ALTER TABLE riders DROP CONSTRAINT IF EXISTS riders_status_check;

-- Update rider status values from 'available' to 'online', 'busy' to 'offline'
UPDATE riders SET status = 'online' WHERE status = 'available';
UPDATE riders SET status = 'offline' WHERE status = 'busy';

-- Add new status constraint with 'online' and 'offline' only
ALTER TABLE riders ADD CONSTRAINT riders_status_check CHECK (status IN ('online', 'offline'));

-- Add zone_id to riders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'zone_id'
  ) THEN
    ALTER TABLE riders ADD COLUMN zone_id uuid REFERENCES zones(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add active_orders to riders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'active_orders'
  ) THEN
    ALTER TABLE riders ADD COLUMN active_orders integer DEFAULT 0;
  END IF;
END $$;

-- Add pickup_zone_id to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'pickup_zone_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN pickup_zone_id uuid REFERENCES zones(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add assigned_rider_id to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'assigned_rider_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN assigned_rider_id uuid REFERENCES riders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add assignment_status to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'assignment_status'
  ) THEN
    ALTER TABLE orders ADD COLUMN assignment_status text DEFAULT 'pending' CHECK (assignment_status IN ('pending', 'assigned', 'accepted', 'rejected'));
  END IF;
END $$;

-- Add assigned_at to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'assigned_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN assigned_at timestamptz;
  END IF;
END $$;

-- Add assignment_timeout_at to orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'assignment_timeout_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN assignment_timeout_at timestamptz;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_assigned_rider_id ON orders(assigned_rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_assignment_status ON orders(assignment_status);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_zone_id ON orders(pickup_zone_id);
CREATE INDEX IF NOT EXISTS idx_riders_zone_id ON riders(zone_id);
CREATE INDEX IF NOT EXISTS idx_riders_active_orders ON riders(active_orders);
CREATE INDEX IF NOT EXISTS idx_riders_status_zone ON riders(status, zone_id);

-- RLS Policies for zones

-- Admins can manage all zones
CREATE POLICY "Admins can view all zones"
  ON zones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert zones"
  ON zones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update zones"
  ON zones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete zones"
  ON zones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Riders can view all zones
CREATE POLICY "Riders can view all zones"
  ON zones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'rider'
    )
  );

-- Update riders policies to allow viewing assigned_rider_id
CREATE POLICY "Riders can view orders assigned to them via assigned_rider_id"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM riders
      WHERE riders.id = orders.assigned_rider_id AND riders.user_id = auth.uid()
    )
  );

-- Allow riders to update assignment status for orders assigned to them
CREATE POLICY "Riders can update assignment status for assigned orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM riders
      WHERE riders.id = orders.assigned_rider_id AND riders.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM riders
      WHERE riders.id = orders.assigned_rider_id AND riders.user_id = auth.uid()
    )
  );

-- Trigger to update updated_at on zones
CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment active_orders when rider accepts
CREATE OR REPLACE FUNCTION increment_rider_active_orders()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assignment_status = 'accepted' AND OLD.assignment_status != 'accepted' THEN
    UPDATE riders
    SET active_orders = active_orders + 1
    WHERE id = NEW.assigned_rider_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement active_orders when order is completed
CREATE OR REPLACE FUNCTION decrement_rider_active_orders()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('delivered', 'cancelled') AND OLD.status NOT IN ('delivered', 'cancelled') THEN
    IF NEW.assigned_rider_id IS NOT NULL THEN
      UPDATE riders
      SET active_orders = GREATEST(active_orders - 1, 0)
      WHERE id = NEW.assigned_rider_id;
    ELSIF NEW.rider_id IS NOT NULL THEN
      UPDATE riders
      SET active_orders = GREATEST(active_orders - 1, 0)
      WHERE id = NEW.rider_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_increment_active_orders ON orders;
CREATE TRIGGER trigger_increment_active_orders
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.assignment_status = 'accepted' AND OLD.assignment_status != 'accepted')
  EXECUTE FUNCTION increment_rider_active_orders();

DROP TRIGGER IF EXISTS trigger_decrement_active_orders ON orders;
CREATE TRIGGER trigger_decrement_active_orders
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status IN ('delivered', 'cancelled') AND OLD.status NOT IN ('delivered', 'cancelled'))
  EXECUTE FUNCTION decrement_rider_active_orders();
