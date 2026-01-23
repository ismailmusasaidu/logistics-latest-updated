-- # Create order complaints table
--
-- 1. New Tables
--   - order_complaints
--     - id (uuid, primary key)
--     - order_id (uuid, foreign key to orders)
--     - rider_id (uuid, foreign key to riders)
--     - complaint_type (text) - type of complaint
--     - description (text) - detailed complaint description
--     - status (text) - open, resolved, dismissed
--     - resolved_by (uuid, nullable) - admin who resolved it
--     - resolved_at (timestamptz, nullable)
--     - created_at (timestamptz)
--     - updated_at (timestamptz)
--
-- 2. Security
--   - Enable RLS on order_complaints table
--   - Riders can create complaints for their assigned orders
--   - Riders can view their own complaints
--   - Admins can view and manage all complaints

CREATE TABLE IF NOT EXISTS order_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  rider_id uuid REFERENCES riders(id) ON DELETE CASCADE NOT NULL,
  complaint_type text NOT NULL CHECK (complaint_type IN ('customer_issue', 'address_problem', 'package_issue', 'payment_issue', 'other')),
  description text NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE order_complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders can create complaints for assigned orders"
  ON order_complaints
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM riders
      JOIN orders ON orders.rider_id = riders.id
      WHERE riders.user_id = auth.uid()
      AND orders.id = order_complaints.order_id
      AND riders.id = order_complaints.rider_id
    )
  );

CREATE POLICY "Riders can view own complaints"
  ON order_complaints
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM riders
      WHERE riders.id = order_complaints.rider_id
      AND riders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all complaints"
  ON order_complaints
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_order_complaints_order_id ON order_complaints(order_id);
CREATE INDEX IF NOT EXISTS idx_order_complaints_rider_id ON order_complaints(rider_id);
CREATE INDEX IF NOT EXISTS idx_order_complaints_status ON order_complaints(status);