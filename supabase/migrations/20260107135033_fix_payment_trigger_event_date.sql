/*
  # Исправление триггера выплат - использование правильного поля даты

  1. Проблема
    - Триггер пытается обратиться к несуществующей колонке start_date в events
    - В таблице events используется колонка event_date, а не start_date
  
  2. Решение
    - Изменяем функцию триггера для использования event_date вместо start_date
  
  3. Изменения
    - Обновляем функцию create_payment_from_personnel_assignment
    - Заменяем start_date на event_date
*/

-- Пересоздаем функцию с правильным названием колонки
CREATE OR REPLACE FUNCTION create_payment_from_personnel_assignment()
RETURNS TRIGGER AS $$
DECLARE
  budget_event_id uuid;
  budget_total numeric;
  budget_exchange_rate numeric;
  budget_total_rub numeric;
  event_date_value date;
  payment_month date;
BEGIN
  -- Получаем event_id, total и exchange_rate из budget_items
  SELECT event_id, total, exchange_rate 
  INTO budget_event_id, budget_total, budget_exchange_rate
  FROM budget_items
  WHERE id = NEW.budget_item_id;
  
  -- Вычисляем сумму в рублях
  budget_total_rub := budget_total * budget_exchange_rate;
  
  -- Если event_id найден, получаем дату мероприятия
  IF budget_event_id IS NOT NULL THEN
    SELECT event_date INTO event_date_value
    FROM events
    WHERE id = budget_event_id;
    
    -- Если дата найдена, создаем выплату
    IF event_date_value IS NOT NULL THEN
      payment_month := date_trunc('month', event_date_value)::date;
      
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