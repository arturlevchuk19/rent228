/*
  # Fix Payment Duplication and Add Work Item Link

  1. Problem
    - When editing personnel assignments, old payment records remain
    - New payments are created on insert, causing duplicates
    - No link between payments and work_items

  2. Solutions
    - Add delete trigger to remove payments when personnel assignments are deleted
    - Add work_item_id column to payments table
    - Update trigger to include work_item_id from budget_items

  3. Changes
    - New column: payments.work_item_id (uuid, nullable, FK to work_items)
    - New trigger: delete_payment_on_personnel_unassignment (DELETE on budget_item_personnel)
    - Updated trigger: create_payment_on_personnel_assignment (now includes work_item_id)
*/

-- Add work_item_id to payments table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'work_item_id'
  ) THEN
    ALTER TABLE payments ADD COLUMN work_item_id uuid REFERENCES work_items(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create delete trigger for payments
CREATE OR REPLACE FUNCTION delete_payment_on_personnel_unassignment()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM payments
  WHERE budget_item_id = OLD.budget_item_id
    AND personnel_id = OLD.personnel_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS delete_payment_on_personnel_unassignment ON budget_item_personnel;
CREATE TRIGGER delete_payment_on_personnel_unassignment
  AFTER DELETE ON budget_item_personnel
  FOR EACH ROW
  EXECUTE FUNCTION delete_payment_on_personnel_unassignment();

-- Update insert trigger to include work_item_id
CREATE OR REPLACE FUNCTION create_payment_from_personnel_assignment()
RETURNS TRIGGER AS $$
DECLARE
  budget_event_id uuid;
  budget_total_rub numeric;
  budget_work_item_id uuid;
  event_start_date date;
  payment_month date;
BEGIN
  -- Get event_id, total_rub, and work_item_id from budget_items
  SELECT event_id, total_rub, work_item_id INTO budget_event_id, budget_total_rub, budget_work_item_id
  FROM budget_items
  WHERE id = NEW.budget_item_id;
  
  -- If event_id is found, get the event start date
  IF budget_event_id IS NOT NULL THEN
    SELECT start_date INTO event_start_date
    FROM events
    WHERE id = budget_event_id;
    
    -- If date is found, create payment
    IF event_start_date IS NOT NULL THEN
      payment_month := date_trunc('month', event_start_date)::date;
      
      INSERT INTO payments (
        personnel_id,
        event_id,
        budget_item_id,
        work_item_id,
        month,
        amount,
        status
      ) VALUES (
        NEW.personnel_id,
        budget_event_id,
        NEW.budget_item_id,
        budget_work_item_id,
        payment_month,
        COALESCE(budget_total_rub, 0),
        'Запланировано'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_payment_on_personnel_assignment ON budget_item_personnel;
CREATE TRIGGER create_payment_on_personnel_assignment
  AFTER INSERT ON budget_item_personnel
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_from_personnel_assignment();