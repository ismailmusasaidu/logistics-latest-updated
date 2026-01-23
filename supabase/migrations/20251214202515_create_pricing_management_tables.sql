/*
  # Create Pricing Management System

  1. New Tables
    - `delivery_zones`
      - `id` (uuid, primary key)
      - `zone_name` (text) - Name of the delivery zone (e.g., Zone A)
      - `min_distance` (numeric) - Minimum distance in km
      - `max_distance` (numeric) - Maximum distance in km
      - `base_price` (numeric) - Base delivery price in currency
      - `is_active` (boolean) - Whether zone is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, references auth.users)
      - `updated_by` (uuid, references auth.users)
    
    - `order_type_adjustments`
      - `id` (uuid, primary key)
      - `adjustment_name` (text) - Name of adjustment (e.g., Groceries, Medicine)
      - `adjustment_type` (text) - Type of adjustment (flat, percentage)
      - `adjustment_value` (numeric) - Value to add or percentage
      - `is_active` (boolean) - Whether adjustment is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, references auth.users)
    
    - `promotions`
      - `id` (uuid, primary key)
      - `promo_code` (text, unique) - Promo code
      - `promo_name` (text) - Name of promotion
      - `discount_type` (text) - flat, percentage, free_delivery
      - `discount_value` (numeric) - Discount amount or percentage
      - `min_order_value` (numeric) - Minimum order value to qualify
      - `max_discount` (numeric) - Maximum discount cap
      - `is_active` (boolean) - Whether promotion is active
      - `is_first_order_only` (boolean) - Only for first orders
      - `start_date` (timestamptz) - When promotion starts
      - `end_date` (timestamptz) - When promotion ends
      - `usage_limit` (integer) - Max number of uses
      - `usage_count` (integer) - Current usage count
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, references auth.users)
    
    - `pricing_change_logs`
      - `id` (uuid, primary key)
      - `table_name` (text) - Which table was changed
      - `record_id` (uuid) - ID of changed record
      - `field_name` (text) - Which field was changed
      - `old_value` (text) - Previous value
      - `new_value` (text) - New value
      - `changed_by` (uuid, references auth.users) - Admin who made change
      - `changed_at` (timestamptz) - When change was made

  2. Security
    - Enable RLS on all tables
    - Only admins can manage pricing
    - All users can read active pricing data for calculations
    - Comprehensive audit trail for all pricing changes

  3. Indexes
    - Index on delivery_zones distance ranges for quick lookups
    - Index on promotions promo_code for quick validation
    - Index on pricing_change_logs for audit queries
*/

-- Create delivery_zones table
CREATE TABLE IF NOT EXISTS delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name text NOT NULL,
  min_distance numeric(6,2) NOT NULL DEFAULT 0,
  max_distance numeric(6,2) NOT NULL,
  base_price numeric(10,2) NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT valid_distance_range CHECK (max_distance > min_distance),
  CONSTRAINT positive_price CHECK (base_price >= 0)
);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

-- Create order_type_adjustments table
CREATE TABLE IF NOT EXISTS order_type_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_name text NOT NULL UNIQUE,
  adjustment_type text NOT NULL DEFAULT 'flat' CHECK (adjustment_type IN ('flat', 'percentage')),
  adjustment_value numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE order_type_adjustments ENABLE ROW LEVEL SECURITY;

-- Create promotions table
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code text UNIQUE NOT NULL,
  promo_name text NOT NULL,
  discount_type text NOT NULL DEFAULT 'flat' CHECK (discount_type IN ('flat', 'percentage', 'free_delivery')),
  discount_value numeric(10,2) NOT NULL DEFAULT 0,
  min_order_value numeric(10,2) DEFAULT 0,
  max_discount numeric(10,2),
  is_active boolean DEFAULT true,
  is_first_order_only boolean DEFAULT false,
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  usage_limit integer,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date > start_date),
  CONSTRAINT valid_usage_limit CHECK (usage_limit IS NULL OR usage_limit > 0)
);

ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Create pricing_change_logs table
CREATE TABLE IF NOT EXISTS pricing_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now()
);

ALTER TABLE pricing_change_logs ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_delivery_zones_distance ON delivery_zones(min_distance, max_distance) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_delivery_zones_active ON delivery_zones(is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(promo_code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_pricing_logs_record ON pricing_change_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_pricing_logs_date ON pricing_change_logs(changed_at DESC);

-- RLS Policies for delivery_zones

CREATE POLICY "Anyone can view active delivery zones"
  ON delivery_zones FOR SELECT
  USING (is_active = true OR auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can insert delivery zones"
  ON delivery_zones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can update delivery zones"
  ON delivery_zones FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can delete delivery zones"
  ON delivery_zones FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for order_type_adjustments

CREATE POLICY "Anyone can view active order type adjustments"
  ON order_type_adjustments FOR SELECT
  USING (is_active = true OR auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

CREATE POLICY "Only admins can manage order type adjustments"
  ON order_type_adjustments FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for promotions

CREATE POLICY "Anyone can view active promotions"
  ON promotions FOR SELECT
  USING (
    (is_active = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now()))
    OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
  );

CREATE POLICY "Only admins can manage promotions"
  ON promotions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS Policies for pricing_change_logs

CREATE POLICY "Only admins can view pricing change logs"
  ON pricing_change_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Only admins can insert pricing change logs"
  ON pricing_change_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pricing_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_delivery_zones_updated_at ON delivery_zones;
CREATE TRIGGER update_delivery_zones_updated_at
  BEFORE UPDATE ON delivery_zones
  FOR EACH ROW
  EXECUTE FUNCTION update_pricing_updated_at();

DROP TRIGGER IF EXISTS update_order_type_adjustments_updated_at ON order_type_adjustments;
CREATE TRIGGER update_order_type_adjustments_updated_at
  BEFORE UPDATE ON order_type_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_pricing_updated_at();

DROP TRIGGER IF EXISTS update_promotions_updated_at ON promotions;
CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_pricing_updated_at();

-- Insert default delivery zones
INSERT INTO delivery_zones (zone_name, min_distance, max_distance, base_price, is_active)
VALUES
  ('Zone A - 0-3km', 0, 3, 800, true),
  ('Zone B - 3-7km', 3, 7, 1200, true),
  ('Zone C - 7-12km', 7, 12, 1800, true),
  ('Zone D - 12km+', 12, 999, 2500, true)
ON CONFLICT DO NOTHING;

-- Insert default order type adjustments
INSERT INTO order_type_adjustments (adjustment_name, adjustment_type, adjustment_value, is_active)
VALUES
  ('Groceries', 'flat', 0, true),
  ('Medicine', 'flat', 0, true),
  ('Bulk / Heavy Items', 'flat', 300, true),
  ('Express Delivery', 'flat', 500, true)
ON CONFLICT DO NOTHING;
