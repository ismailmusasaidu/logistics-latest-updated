/*
  # Add Automatic Rider Assignment Trigger

  1. Changes
    - Creates a function to automatically call the assign-rider edge function when a new order is created
    - Creates a trigger that fires after INSERT on orders table
    - Only triggers for orders with status 'pending' and no assigned rider

  2. Security
    - Function uses service role key to make HTTP request
    - Only processes pending orders without assigned riders
*/

-- Create function to automatically assign rider when order is created
CREATE OR REPLACE FUNCTION auto_assign_rider_on_order_creation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only auto-assign for pending orders without a rider
  IF NEW.status = 'pending' AND NEW.assigned_rider_id IS NULL THEN
    -- Use pg_net to make async HTTP request to assign-rider edge function
    PERFORM
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/assign-rider',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object('order_id', NEW.id::text)
      );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_assign_rider ON orders;

-- Create trigger that fires after INSERT
CREATE TRIGGER trigger_auto_assign_rider
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_rider_on_order_creation();
