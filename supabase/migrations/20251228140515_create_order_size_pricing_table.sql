/*
  # Create Order Size Pricing Table

  1. New Tables
    - `order_size_pricing`
      - `id` (uuid, primary key)
      - `size` (text) - 'medium' or 'large'
      - `additional_fee` (numeric) - extra charge for this size
      - `is_active` (boolean) - whether this pricing is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `order_size_pricing` table
    - Add policy for authenticated users to read pricing
    - Add policy for admins to manage pricing

  3. Initial Data
    - Insert default pricing for medium and large sizes
*/

CREATE TABLE IF NOT EXISTS order_size_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  size text NOT NULL,
  additional_fee numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT size_check CHECK (size IN ('medium', 'large')),
  CONSTRAINT unique_size UNIQUE (size)
);

ALTER TABLE order_size_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active order size pricing"
  ON order_size_pricing
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can insert order size pricing"
  ON order_size_pricing
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update order size pricing"
  ON order_size_pricing
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete order size pricing"
  ON order_size_pricing
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

INSERT INTO order_size_pricing (size, additional_fee, is_active)
VALUES 
  ('medium', 500, true),
  ('large', 1000, true)
ON CONFLICT (size) DO NOTHING;
