-- QuickDeliver Database Setup
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'rider', 'admin')),
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create riders table
CREATE TABLE IF NOT EXISTS riders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('bike', 'motorcycle', 'car', 'van')),
  vehicle_number text NOT NULL,
  license_number text NOT NULL,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'available', 'busy')),
  rating decimal(3,2) DEFAULT 5.0,
  total_deliveries integer DEFAULT 0,
  current_lat decimal(10,8),
  current_lng decimal(11,8),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE riders ENABLE ROW LEVEL SECURITY;

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rider_id uuid REFERENCES riders(id) ON DELETE SET NULL,
  order_number text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
  pickup_address text NOT NULL,
  pickup_lat decimal(10,8) NOT NULL,
  pickup_lng decimal(11,8) NOT NULL,
  delivery_address text NOT NULL,
  delivery_lat decimal(10,8) NOT NULL,
  delivery_lng decimal(11,8) NOT NULL,
  recipient_name text NOT NULL,
  recipient_phone text NOT NULL,
  package_description text NOT NULL,
  package_weight decimal(5,2),
  delivery_fee decimal(10,2) NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  delivered_at timestamptz
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create order_tracking table
CREATE TABLE IF NOT EXISTS order_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL,
  location_lat decimal(10,8),
  location_lng decimal(11,8),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_tracking ENABLE ROW LEVEL SECURITY;

-- Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  rider_id uuid REFERENCES riders(id) ON DELETE CASCADE NOT NULL,
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_tracking_order_id ON order_tracking(order_id);
CREATE INDEX IF NOT EXISTS idx_riders_status ON riders(status);
CREATE INDEX IF NOT EXISTS idx_riders_user_id ON riders(user_id);

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Riders policies
CREATE POLICY "Riders can view own data"
  ON riders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Riders can update own data"
  ON riders FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all riders"
  ON riders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage riders"
  ON riders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Orders policies
CREATE POLICY "Customers can view own orders"
  ON orders FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Customers can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Riders can view assigned orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM riders
      WHERE riders.id = orders.rider_id AND riders.user_id = auth.uid()
    )
  );

CREATE POLICY "Riders can update assigned orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM riders
      WHERE riders.id = orders.rider_id AND riders.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM riders
      WHERE riders.id = orders.rider_id AND riders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all orders"
  ON orders FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Order tracking policies
CREATE POLICY "Users can view tracking for their orders"
  ON order_tracking FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_tracking.order_id
      AND (orders.customer_id = auth.uid() OR EXISTS (
        SELECT 1 FROM riders
        WHERE riders.id = orders.rider_id AND riders.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Riders can create tracking updates"
  ON order_tracking FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      JOIN riders ON riders.id = orders.rider_id
      WHERE orders.id = order_tracking.order_id AND riders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all tracking"
  ON order_tracking FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Ratings policies
CREATE POLICY "Customers can view ratings for their orders"
  ON ratings FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Customers can create ratings"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Riders can view their ratings"
  ON ratings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM riders
      WHERE riders.id = ratings.rider_id AND riders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all ratings"
  ON ratings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_riders_updated_at BEFORE UPDATE ON riders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
