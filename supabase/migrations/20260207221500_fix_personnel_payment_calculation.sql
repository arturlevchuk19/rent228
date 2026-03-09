-- Improve personnel payment calculation and add triggers to keep amounts in sync

-- 1. Updated function for creating and updating payments on personnel assignment
CREATE OR REPLACE FUNCTION create_payment_from_personnel_assignment()
RETURNS TRIGGER AS $$
DECLARE
  budget_event_id uuid;
  budget_total numeric;
  budget_exchange_rate numeric;
  budget_work_item_id uuid;
  event_date_value date;
  payment_month date;
  personnel_count int;
BEGIN
  -- Get event_id, total, exchange_rate and work_item_id from budget_items
  SELECT event_id, total, exchange_rate, work_item_id 
  INTO budget_event_id, budget_total, budget_exchange_rate, budget_work_item_id
  FROM budget_items
  WHERE id = NEW.budget_item_id;
  
  -- Get personnel count for this budget item
  SELECT count(*) INTO personnel_count
  FROM budget_item_personnel
  WHERE budget_item_id = NEW.budget_item_id;

  -- If event_id is found, get the event date
  IF budget_event_id IS NOT NULL THEN
    SELECT event_date INTO event_date_value FROM events WHERE id = budget_event_id;
    
    IF event_date_value IS NOT NULL THEN
      payment_month := date_trunc('month', event_date_value)::date;
      
      -- Insert the payment for the new assignment
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
        0, -- Will be updated below
        'Запланировано'
      );
      
      -- Update all payments for this budget item to the correct shared amount
      UPDATE payments p
      SET amount = (budget_total * budget_exchange_rate / NULLIF(personnel_count, 0)) * (COALESCE(pers.rate_percentage, 100.0) / 100.0)
      FROM personnel pers
      WHERE p.budget_item_id = NEW.budget_item_id
        AND p.personnel_id = pers.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Updated function for deleting payments and updating remaining ones
CREATE OR REPLACE FUNCTION delete_payment_on_personnel_unassignment()
RETURNS TRIGGER AS $$
DECLARE
  budget_event_id uuid;
  budget_total numeric;
  budget_exchange_rate numeric;
  personnel_count int;
BEGIN
  -- Delete the payment
  DELETE FROM payments
  WHERE budget_item_id = OLD.budget_item_id
    AND personnel_id = OLD.personnel_id;
    
  -- Get remaining personnel count
  SELECT count(*) INTO personnel_count
  FROM budget_item_personnel
  WHERE budget_item_id = OLD.budget_item_id;
  
  -- Update remaining shares
  IF personnel_count > 0 THEN
    SELECT total, exchange_rate INTO budget_total, budget_exchange_rate
    FROM budget_items
    WHERE id = OLD.budget_item_id;

    UPDATE payments p
    SET amount = (budget_total * budget_exchange_rate / personnel_count) * (COALESCE(pers.rate_percentage, 100.0) / 100.0)
    FROM personnel pers
    WHERE p.budget_item_id = OLD.budget_item_id
      AND p.personnel_id = pers.id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 3. New function to update payments when budget item (price/quantity) changes
CREATE OR REPLACE FUNCTION update_payments_on_budget_item_change()
RETURNS TRIGGER AS $$
DECLARE
  personnel_count int;
BEGIN
  -- Only proceed if total or exchange_rate changed
  IF (OLD.total IS DISTINCT FROM NEW.total) OR (OLD.exchange_rate IS DISTINCT FROM NEW.exchange_rate) THEN
    SELECT count(*) INTO personnel_count
    FROM budget_item_personnel
    WHERE budget_item_id = NEW.id;

    IF personnel_count > 0 THEN
      UPDATE payments p
      SET amount = (NEW.total * NEW.exchange_rate / personnel_count) * (COALESCE(pers.rate_percentage, 100.0) / 100.0)
      FROM personnel pers
      WHERE p.budget_item_id = NEW.id
        AND p.personnel_id = pers.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-create the triggers
DROP TRIGGER IF EXISTS create_payment_on_personnel_assignment ON budget_item_personnel;
CREATE TRIGGER create_payment_on_personnel_assignment
  AFTER INSERT ON budget_item_personnel
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_from_personnel_assignment();

DROP TRIGGER IF EXISTS delete_payment_on_personnel_unassignment ON budget_item_personnel;
CREATE TRIGGER delete_payment_on_personnel_unassignment
  AFTER DELETE ON budget_item_personnel
  FOR EACH ROW
  EXECUTE FUNCTION delete_payment_on_personnel_unassignment();

DROP TRIGGER IF EXISTS update_payments_on_budget_item_change_trigger ON budget_items;
CREATE TRIGGER update_payments_on_budget_item_change_trigger
  AFTER UPDATE OF total, exchange_rate ON budget_items
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_on_budget_item_change();

-- 5. Add trigger to update payment months when event date changes
CREATE OR REPLACE FUNCTION update_payments_month_on_event_date_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.event_date IS DISTINCT FROM NEW.event_date THEN
    UPDATE payments
    SET month = date_trunc('month', NEW.event_date)::date
    WHERE event_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_payments_month_on_event_date_change_trigger ON events;
CREATE TRIGGER update_payments_month_on_event_date_change_trigger
  AFTER UPDATE OF event_date ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_month_on_event_date_change();
