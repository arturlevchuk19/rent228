/*
  # Исправление триггера создания выплат

  1. Проблема
    - Старый триггер пытался обращаться к несуществующему полю personnel_id в таблице budget_items
    - Связь между budget_items и персоналом осуществляется через junction table budget_item_personnel

  2. Решение
    - Удаляем старый триггер на budget_items
    - Создаем новый триггер на budget_item_personnel
    - Новый триггер срабатывает при добавлении персонала к элементу сметы

  3. Логика нового триггера
    - Извлекает event_id из budget_item
    - Извлекает дату начала мероприятия
    - Извлекает сумму из budget_item (поле total_rub)
    - Создает запись о выплате на месяц начала мероприятия
*/

-- Удаляем старый триггер и функцию
DROP TRIGGER IF EXISTS create_payment_on_budget_item_insert ON budget_items;
DROP FUNCTION IF EXISTS create_payment_from_budget_item();

-- Создаем новую функцию для создания выплаты при назначении персонала
CREATE OR REPLACE FUNCTION create_payment_from_personnel_assignment()
RETURNS TRIGGER AS $$
DECLARE
  budget_event_id uuid;
  budget_total_rub numeric;
  event_start_date date;
  payment_month date;
BEGIN
  -- Получаем event_id и total_rub из budget_items
  SELECT event_id, total_rub INTO budget_event_id, budget_total_rub
  FROM budget_items
  WHERE id = NEW.budget_item_id;
  
  -- Если event_id найден, получаем дату начала мероприятия
  IF budget_event_id IS NOT NULL THEN
    SELECT start_date INTO event_start_date
    FROM events
    WHERE id = budget_event_id;
    
    -- Если дата найдена, создаем выплату
    IF event_start_date IS NOT NULL THEN
      payment_month := date_trunc('month', event_start_date)::date;
      
      INSERT INTO payments (
        personnel_id,
        event_id,
        budget_item_id,
        month,
        amount,
        status
      ) VALUES (
        NEW.personnel_id,
        budget_event_id,
        NEW.budget_item_id,
        payment_month,
        COALESCE(budget_total_rub, 0),
        'Запланировано'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создаем триггер на budget_item_personnel
DROP TRIGGER IF EXISTS create_payment_on_personnel_assignment ON budget_item_personnel;
CREATE TRIGGER create_payment_on_personnel_assignment
  AFTER INSERT ON budget_item_personnel
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_from_personnel_assignment();