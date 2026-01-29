/*
  # Add Automatic Rider Rating Update Trigger

  1. Changes
    - Creates a function to calculate and update rider's average rating
    - Adds a trigger on the ratings table that fires after INSERT or DELETE
    - Automatically recalculates rider's rating based on all submitted ratings
  
  2. How It Works
    - When a customer submits a rating, the trigger fires
    - Calculates the average of all ratings for that rider
    - Updates the riders.rating field with the new average
    - If no ratings exist, keeps the default 5.0 rating
  
  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Ensures accurate rating calculations regardless of user permissions
*/

-- Create function to update rider rating
CREATE OR REPLACE FUNCTION update_rider_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the rider's rating with the average of all their ratings
  UPDATE riders
  SET rating = (
    SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 5.0)
    FROM ratings
    WHERE rider_id = COALESCE(NEW.rider_id, OLD.rider_id)
  )
  WHERE id = COALESCE(NEW.rider_id, OLD.rider_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires after rating insert or delete
DROP TRIGGER IF EXISTS trigger_update_rider_rating ON ratings;
CREATE TRIGGER trigger_update_rider_rating
  AFTER INSERT OR DELETE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_rider_rating();