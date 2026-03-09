/*
  # Создание триггера для автоматического создания выплат

  1. Функция триггера
    - Автоматически создает запись о выплате при добавлении персонала в элемент сметы
    - Извлекает месяц мероприятия из даты начала мероприятия
    - Использует сумму из элемента сметы
    - Устанавливает статус "Запланировано"

  2. Триггер
    - Срабатывает при INSERT на таблице budget_items
    - Только для элементов с типом "personnel" (personnel_id не NULL)
    - Вызывает функцию создания записи о выплате

  3. Важные примечания
    - Триггер создает выплату только для новых элементов сметы с персоналом
    - Месяц выплаты берется из даты начала мероприятия
    - Если event_id отсутствует, выплата не создается
*/

CREATE OR REPLACE FUNCTION create_payment_from_budget_item()
RETURNS TRIGGER AS $$
DECLARE
  event_start_date date;
  payment_month date;
BEGIN
  IF NEW.personnel_id IS NOT NULL AND NEW.event_id IS NOT NULL THEN
    SELECT start_date INTO event_start_date
    FROM events
    WHERE id = NEW.event_id;
    
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
        NEW.event_id,
        NEW.id,
        payment_month,
        NEW.total_rub,
        'Запланировано'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_payment_on_budget_item_insert ON budget_items;
CREATE TRIGGER create_payment_on_budget_item_insert
  AFTER INSERT ON budget_items
  FOR EACH ROW
  EXECUTE FUNCTION create_payment_from_budget_item();