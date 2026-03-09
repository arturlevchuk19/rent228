/*
  # Создание таблицы выплат

  1. Новые таблицы
    - `payments`
      - `id` (uuid, primary key) - Уникальный идентификатор выплаты
      - `personnel_id` (uuid, foreign key) - Связь с сотрудником/подрядчиком
      - `event_id` (uuid, nullable, foreign key) - Связь с мероприятием
      - `budget_item_id` (uuid, nullable, foreign key) - Связь с элементом сметы
      - `month` (date) - Месяц выплаты (хранится как первое число месяца)
      - `amount` (numeric) - Сумма выплаты в рублях
      - `status` (text) - Статус выплаты (Запланировано, Выплачено, Просрочено)
      - `payment_date` (date, nullable) - Фактическая дата выплаты
      - `notes` (text, nullable) - Примечания к выплате
      - `created_at` (timestamptz) - Дата создания записи
      - `updated_at` (timestamptz) - Дата последнего обновления

  2. Безопасность
    - Включение RLS для таблицы `payments`
    - Политики для аутентифицированных пользователей:
      - SELECT: Чтение всех записей о выплатах
      - INSERT: Создание новых записей о выплатах
      - UPDATE: Обновление записей о выплатах
      - DELETE: Удаление записей о выплатах

  3. Индексы
    - Индекс по personnel_id для быстрого поиска выплат сотруднику
    - Индекс по event_id для поиска выплат по мероприятию
    - Индекс по month для фильтрации по месяцам
    - Индекс по status для фильтрации по статусу
*/

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  budget_item_id uuid REFERENCES budget_items(id) ON DELETE SET NULL,
  month date NOT NULL,
  amount numeric(10, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Запланировано',
  payment_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Создаем индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_payments_personnel_id ON payments(personnel_id);
CREATE INDEX IF NOT EXISTS idx_payments_event_id ON payments(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Включаем RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Политики доступа для аутентифицированных пользователей
CREATE POLICY "Authenticated users can view all payments"
  ON payments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create payments"
  ON payments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update payments"
  ON payments
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete payments"
  ON payments
  FOR DELETE
  TO authenticated
  USING (true);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS payments_updated_at_trigger ON payments;
CREATE TRIGGER payments_updated_at_trigger
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();