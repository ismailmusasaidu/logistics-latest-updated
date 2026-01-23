/*
  # Create Service Requests Table

  ## Overview
  This migration creates a table for managing special service requests (Gadget Delivery and Relocation).
  Customers submit basic information and the team contacts them for full details.

  ## 1. New Tables
    - `service_requests`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references profiles) - Who requested the service
      - `full_name` (text) - Customer's full name
      - `phone` (text) - Contact phone number
      - `pickup_area` (text) - Pickup location
      - `dropoff_area` (text) - Drop-off location
      - `service_type` (text) - gadget_delivery or relocation
      - `status` (text) - pending, contacted, confirmed, completed
      - `notes` (text) - Admin notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  ## 2. Security
    - Enable RLS on service_requests table
    - Customers can view and create their own requests
    - Admins can view and manage all requests

  ## 3. Indexes
    - Add index on customer_id for performance
    - Add index on status for filtering
    - Add index on service_type for filtering
*/

-- Create service_requests table
CREATE TABLE IF NOT EXISTS service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  pickup_area text NOT NULL,
  dropoff_area text NOT NULL,
  service_type text NOT NULL CHECK (service_type IN ('gadget_delivery', 'relocation')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'confirmed', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_service_requests_customer_id ON service_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_service_type ON service_requests(service_type);
CREATE INDEX IF NOT EXISTS idx_service_requests_created_at ON service_requests(created_at DESC);

-- RLS Policies

-- Customers can view their own service requests
CREATE POLICY "Customers can view own service requests"
  ON service_requests FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

-- Customers can create service requests
CREATE POLICY "Customers can create service requests"
  ON service_requests FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- Admins can view all service requests
CREATE POLICY "Admins can view all service requests"
  ON service_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admins can update service requests
CREATE POLICY "Admins can update service requests"
  ON service_requests FOR UPDATE
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

-- Admins can delete service requests
CREATE POLICY "Admins can delete service requests"
  ON service_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER update_service_requests_updated_at BEFORE UPDATE ON service_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
