# RentMaster2 - Схема базы данных

## 📋 Обзор

База данных RentMaster2 использует PostgreSQL через Supabase. Все таблицы защищены Row Level Security (RLS) политиками.

---

## 📊 Диаграмма отношений (ER Diagram)

```
users ──┬──> staff
        ├──> events (created_by)
        └──> budget_items (through events)

clients ──> events
venues ──> events
organizers ──> events

events ──> budget_items
       └──> warehouse_specification_items

equipment ──┬──> budget_items
            ├──> equipment_compositions (parent/child)
            └──> equipment_modifications
            
equipment_modifications ──> budget_items

categories ──> budget_items

personnel ──> payments
work_items ──> payments

templates ──┬──> template_items
          └──> template_categories
```

---

## 📑 Таблицы

### 1. users

**Описание**: Профили пользователей с ролевым доступом

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK, связь с auth.users |
| `email` | text | Email пользователя |
| `full_name` | text | Полное имя |
| `role` | text | superuser, admin, clerk, staff, warehouse |
| `status` | text | pending, active, inactive |
| `created_at` | timestamptz | Дата создания |

**RLS Policies**:
- Users can view own profile
- Admins can view all users
- Admins can update users

---

### 2. equipment

**Описание**: Каталог оборудования

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `category` | text | Категория оборудования |
| `type` | text | Тип оборудования |
| `subtype` | text | Подтип (опционально) |
| `article` | text | Артикул (уникальный) |
| `name` | text | Название |
| `price_usd` | numeric(10,2) | Цена аренды в USD |
| `power_consumption` | numeric(10,2) | Потребляемая мощность (Вт) |
| `weight` | numeric(10,2) | Вес (кг) |
| `cost_price` | numeric(10,2) | Себестоимость |
| `available_for_rent` | boolean | Доступно для аренды |
| `is_composite` | boolean | Является композицией |
| `description` | text | Описание |
| `created_at` | timestamptz | Дата создания |

**RLS Policies**:
- Viewable by authenticated users
- Manageable by admins

**Индексы**:
- `idx_equipment_category` на `category`
- `idx_equipment_available` на `available_for_rent`
- `idx_equipment_article` на `article`

---

### 3. equipment_compositions

**Описание**: Связи между композитным оборудованием и его компонентами

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `parent_equipment_id` | uuid | FK → equipment (композиция) |
| `child_equipment_id` | uuid | FK → equipment (компонент) |
| `quantity` | numeric(10,2) | Количество компонента |
| `created_at` | timestamptz | Дата создания |

**RLS Policies**:
- Viewable by authenticated users
- Manageable by admins

---

### 4. equipment_modifications

**Описание**: Модификации/варианты оборудования

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `equipment_id` | uuid | FK → equipment |
| `name` | text | Название модификации |
| `description` | text | Описание |
| `price_modifier` | numeric(10,2) | Изменение цены (может быть отрицательным) |
| `created_at` | timestamptz | Дата создания |

**RLS Policies**:
- Viewable by authenticated users
- Manageable by admins and clerks

---

### 5. clients

**Описание**: База клиентов

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `name` | text | Название компании/имя |
| `contact_person` | text | Контактное лицо |
| `email` | text | Email |
| `phone` | text | Телефон |
| `notes` | text | Заметки |
| `created_at` | timestamptz | Дата создания |

**RLS Policies**:
- Viewable by authenticated users
- Manageable by admins

---

### 6. venues

**Описание**: Площадки для мероприятий

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `name` | text | Название площадки |
| `address` | text | Адрес |
| `city` | text | Город |
| `distance_km` | numeric(10,2) | Расстояние от склада (км) |
| `notes` | text | Заметки (парковка, доступ и т.д.) |
| `created_at` | timestamptz | Дата создания |

**RLS Policies**:
- Viewable by authenticated users
- Manageable by admins

---

### 7. organizers

**Описание**: Организаторы мероприятий

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `name` | text | Имя организатора |
| `contact_person` | text | Контактное лицо |
| `email` | text | Email |
| `phone` | text | Телефон |
| `notes` | text | Заметки |
| `created_at` | timestamptz | Дата создания |

**RLS Policies**:
- Viewable by authenticated users
- Manageable by admins

---

### 8. events

**Описание**: Мероприятия

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `name` | text | Название мероприятия |
| `client_id` | uuid | FK → clients |
| `venue_id` | uuid | FK → venues |
| `organizer_id` | uuid | FK → organizers |
| `event_date` | date | Дата мероприятия |
| `event_type` | text | Тип мероприятия |
| `status` | text | Статус (на русском) |
| `progress` | jsonb | Прогресс выполнения |
| `notes` | text | Заметки |
| `created_at` | timestamptz | Дата создания |
| `created_by` | uuid | FK → users |

**RLS Policies**:
- Viewable by authenticated users
- Manageable by admins
- Warehouse can view assigned events

**Индексы**:
- `idx_events_date` на `event_date`
- `idx_events_status` на `status`

---

### 9. budget_items

**Описание**: Позиции сметы для мероприятий

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `event_id` | uuid | FK → events |
| `category_id` | uuid | FK → categories |
| `item_type` | text | equipment, work |
| `equipment_id` | uuid | FK → equipment |
| `modification_id` | uuid | FK → equipment_modifications |
| `work_item_id` | uuid | FK → work_items |
| `quantity` | numeric(10,2) | Количество |
| `days` | numeric(10,2) | Дни аренды |
| `price_rub` | numeric(12,2) | Цена в рублях |
| `exchange_rate` | numeric(10,4) | Курс обмена |
| `total_rub` | numeric(12,2) | Итого в рублях |
| `notes` | text | Заметки |
| `sort_order` | integer | Порядок сортировки |
| `created_at` | timestamptz | Дата создания |

**RLS Policies**:
- Viewable by authenticated users
- Manageable by admins
- Warehouse can view for assigned events

---

### 10. categories

**Описание**: Категории для группировки позиций сметы

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `name` | text | Название категории |
| `description` | text | Описание |
| `sort_order` | integer | Порядок сортировки |
| `is_template` | boolean | Признак категории из шаблона (не отображается в дропдауне) |
| `created_at` | timestamptz | Дата создания |

**RLS Policies**:
- Viewable by authenticated users
- Manageable by admins

---

### 11. work_items

**Описание**: Типы работ для смет

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `name` | text | Название работы (уникальное) |
| `description` | text | Описание |
| `unit` | text | Единица измерения |
| `default_price_rub` | numeric(10,2) | Цена по умолчанию (рубли) |
| `created_at` | timestamptz | Дата создания |

**RLS Policies**:
- Viewable by authenticated users
- Manageable by admins

**Constraint**: UNIQUE на `name`

---

### 12. personnel

**Описание**: База персонала

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `full_name` | text | Полное имя |
| `phone` | text | Телефон |
| `email` | text | Email |
| `position` | text | Должность |
| `rate_per_hour` | numeric(10,2) | Ставка за час |
| `notes` | text | Заметки |
| `created_at` | timestamptz | Дата создания |

**RLS Policies**:
- Viewable by authenticated users
- Manageable by admins

---

### 13. payments

**Описание**: Платежи персоналу

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `event_id` | uuid | FK → events |
| `personnel_id` | uuid | FK → personnel |
| `work_item_id` | uuid | FK → work_items |
| `amount_rub` | numeric(12,2) | Сумма в рублях |
| `event_date` | date | Дата мероприятия |
| `status` | text | pending, paid |
| `notes` | text | Заметки |
| `created_at` | timestamptz | Дата создания |

**RLS Policies**:
- Viewable by authenticated users
- Personnel can view own payments
- Manageable by admins

**Trigger**: Автоматическое создание при добавлении budget_item с work_item_id

---

### 14. templates

**Описание**: Шаблоны смет

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `name` | text | Название шаблона |
| `description` | text | Описание |
| `created_by` | uuid | FK → users |
| `created_at` | timestamptz | Дата создания |
| `updated_at` | timestamptz | Дата обновления |

**RLS Policies**:
- Viewable by authenticated users
- Manageable by admins

---

### 15. template_items

**Описание**: Позиции шаблонов

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `template_id` | uuid | FK → templates |
| `category_id` | uuid | FK → categories |
| `item_type` | text | equipment, work |
| `equipment_id` | uuid | FK → equipment |
| `modification_id` | uuid | FK → equipment_modifications |
| `work_item_id` | uuid | FK → work_items |
| `quantity` | numeric(10,2) | Количество по умолчанию |
| `days` | numeric(10,2) | Дни по умолчанию |
| `price_rub` | numeric(12,2) | Цена |
| `notes` | text | Заметки |
| `sort_order` | integer | Порядок сортировки |
| `created_at` | timestamptz | Дата создания |

**RLS Policies**:
- Viewable by authenticated users
- Manageable by admins

---

### 16. warehouse_specification_items

**Описание**: Складские спецификации для мероприятий

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | uuid | PK |
| `event_id` | uuid | FK → events |
| `equipment_id` | uuid | FK → equipment |
| `quantity` | numeric(10,2) | Требуемое количество |
| `status` | text | pending, prepared, loaded, returned |
| `notes` | text | Заметки |
| `created_at` | timestamptz | Дата создания |
| `updated_at` | timestamptz | Дата обновления |

**RLS Policies**:
- Viewable by authenticated users
- Warehouse can manage for assigned events
- Admins can manage all

---

## 🔐 Row Level Security (RLS)

Все таблицы имеют включенный RLS с политиками на основе ролей:

### Иерархия доступа

1. **Superuser** - полный доступ ко всем таблицам и операциям
2. **Admin** - полный доступ, кроме управления ролями superuser
3. **Clerk** - управление оборудованием, инвентарем, модификациями
4. **Warehouse** - просмотр назначенных мероприятий, управление спецификациями
5. **Staff** - просмотр собственного профиля и назначенных платежей

### Типовые политики

```sql
-- Просмотр: authenticated users
CREATE POLICY "table_viewable_by_authenticated"
  ON table_name FOR SELECT
  TO authenticated
  USING (true);

-- Управление: admins only
CREATE POLICY "table_manageable_by_admins"
  ON table_name FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('superuser', 'admin')
    )
  );
```

---

## 🔄 Triggers

### 1. Payment Auto-creation Trigger

**Таблица**: `budget_items`  
**Действие**: AFTER INSERT OR UPDATE  
**Функция**: `handle_budget_item_payment`

Автоматически создает записи в таблице `payments` при добавлении/обновлении budget_item с `work_item_id`.

```sql
CREATE OR REPLACE FUNCTION handle_budget_item_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.work_item_id IS NOT NULL THEN
    INSERT INTO payments (event_id, work_item_id, amount_rub, event_date, status)
    SELECT 
      NEW.event_id,
      NEW.work_item_id,
      NEW.total_rub,
      e.event_date,
      'pending'
    FROM events e
    WHERE e.id = NEW.event_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 📈 Миграции

Миграции хранятся в `supabase/migrations/` и выполняются в алфавитном порядке.

### Список основных миграций

1. `20251124164911_create_core_schema.sql` - Основная схема
2. `20251124172359_fix_users_rls_policy.sql` - Исправление RLS для users
3. `20251124174505_fix_rls_infinite_recursion.sql` - Исправление рекурсии в RLS
4. `20251124174734_create_equipment_schema.sql` - Расширенная схема equipment
5. `20251127131804_update_events_schema_for_requirements.sql` - Обновление events
6. `20251127205419_create_budget_items_schema.sql` - Схема budget_items
7. `20251130201008_create_personnel_schema.sql` - Схема personnel
8. `20251201115703_create_categories_table.sql` - Таблица categories
9. `20260106201111_create_equipment_compositions_table.sql` - Композиции оборудования
10. `20260107090832_create_payments_schema.sql` - Схема payments
11. `20260112124516_create_templates_schema.sql` - Схема templates
12. `20260127005511_create_warehouse_specification_items.sql` - Складские спецификации
13. `20260127160147_20260127_create_equipment_modifications.sql` - Модификации оборудования
14. `20260209120000_add_is_template_to_categories.sql` - Поле is_template в категориях

---

## 🔧 Обслуживание

### Резервное копирование

```bash
# Backup через Supabase Dashboard
# Settings → Database → Database backups

# Или через CLI
supabase db dump -f backup.sql
```

### Восстановление

```bash
supabase db reset
supabase db push
```

### Проверка состояния

```sql
-- Количество записей в основных таблицах
SELECT 
  'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'equipment', COUNT(*) FROM equipment
UNION ALL
SELECT 'events', COUNT(*) FROM events
UNION ALL
SELECT 'budget_items', COUNT(*) FROM budget_items;

-- Проверка RLS
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

---

## 📚 Дополнительные ресурсы

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

---

**Версия документа**: 1.0  
**Дата обновления**: 04.02.2026
