/*
  # Fix Automatic Rider Assignment Trigger

  1. Changes
    - Updates the auto-assignment function to use hardcoded Supabase URL
    - Uses pg_net extension for async HTTP calls
    - Triggers on order INSERT with pending status

  2. Notes
    - The service role key must be configured in Supabase secrets
    - Function runs asynchronously to avoid blocking order creation
*/

-- Drop existing function and recreate with hardcoded URL
DROP FUNCTION IF EXISTS auto_assign_rider_on_order_creation() CASCADE;

CREATE OR REPLACE FUNCTION auto_assign_rider_on_order_creation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text := 'https://bplysrqwzfgcovmhmsvz.supabase.co';
  service_key text;
BEGIN
  -- Only auto-assign for pending orders without a rider
  IF NEW.status = 'pending' AND NEW.assigned_rider_id IS NULL THEN
    -- Get service role key from Supabase secrets
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
    
    -- If no service key found, try using the anon key as fallback
    IF service_key IS NULL THEN
      service_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbHlzcnF3emZnY292bWhtc3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDMyNzMsImV4cCI6MjA4MTIxOTI3M30.dxy2zOJu2WKmAuMA_vATkBozfCN9IRz4a63PX8XcUek';
    END IF;
    
    -- Make async HTTP request to assign-rider edge function
    PERFORM
      net.http_post(
        url := supabase_url || '/functions/v1/assign-rider',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object('order_id', NEW.id::text)
      );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger that fires after INSERT
DROP TRIGGER IF EXISTS trigger_auto_assign_rider ON orders;

CREATE TRIGGER trigger_auto_assign_rider
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_rider_on_order_creation();
