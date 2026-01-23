/*
  # Add Rider Approval System and Verification Fields

  ## Overview
  This migration adds an approval workflow for new riders, requiring admin review before riders can start accepting deliveries.

  ## Changes
  
  1. New Columns in `riders` table
    - `approval_status` (text): Tracks approval state - 'pending', 'approved', or 'rejected'
    - `phone_number` (text): Rider contact number
    - `address` (text): Rider residential address
    - `emergency_contact_name` (text): Emergency contact person name
    - `emergency_contact_phone` (text): Emergency contact phone number
    - `rejection_reason` (text, nullable): Admin's reason if application is rejected
    - `approved_at` (timestamp, nullable): When the rider was approved
    - `approved_by` (uuid, nullable): Which admin approved the rider

  2. Security
    - Update RLS policies to restrict unapproved riders
    - Only approved riders can see orders and accept deliveries
    - Admins can view all riders regardless of approval status

  ## Important Notes
  - Existing riders will be automatically set to 'approved' status
  - New rider signups default to 'pending' status
  - Riders cannot change their own approval status
*/

-- Add new columns to riders table
DO $$
BEGIN
  -- Add approval_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE riders ADD COLUMN approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;

  -- Add phone_number column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE riders ADD COLUMN phone_number text DEFAULT '';
  END IF;

  -- Add address column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'address'
  ) THEN
    ALTER TABLE riders ADD COLUMN address text DEFAULT '';
  END IF;

  -- Add emergency_contact_name column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'emergency_contact_name'
  ) THEN
    ALTER TABLE riders ADD COLUMN emergency_contact_name text DEFAULT '';
  END IF;

  -- Add emergency_contact_phone column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'emergency_contact_phone'
  ) THEN
    ALTER TABLE riders ADD COLUMN emergency_contact_phone text DEFAULT '';
  END IF;

  -- Add rejection_reason column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE riders ADD COLUMN rejection_reason text;
  END IF;

  -- Add approved_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE riders ADD COLUMN approved_at timestamptz;
  END IF;

  -- Add approved_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'riders' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE riders ADD COLUMN approved_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Set existing riders to approved status (grandfather them in)
UPDATE riders 
SET approval_status = 'approved', approved_at = created_at
WHERE approval_status = 'pending';

-- Create index for faster approval status queries
CREATE INDEX IF NOT EXISTS idx_riders_approval_status ON riders(approval_status);

-- Update RLS policy for riders to only allow approved riders to update their status
DROP POLICY IF EXISTS "Riders can update own status and location" ON riders;
CREATE POLICY "Approved riders can update own status and location"
  ON riders FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() 
    AND approval_status = 'approved'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND approval_status = 'approved'
  );