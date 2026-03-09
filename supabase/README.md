# Supabase Database Migrations

## 📋 Обзор

Эта директория содержит все миграции базы данных для проекта RentMaster2.

## 📁 Структура

```
supabase/
├── migrations/           # SQL файлы миграций
├── config.toml          # Конфигурация Supabase
├── run-migrations.sh    # Bash скрипт для выполнения миграций
├── run-migrations.js    # Node.js скрипт для выполнения миграций
├── DATABASE_SCHEMA.md   # Документация схемы базы данных
└── README.md           # Этот файл
```

## 🚀 Быстрый старт

### Предварительные требования

1. Создан проект в Supabase
2. Получены API credentials (URL и ANON_KEY)
3. Установлен Supabase CLI (опционально, но рекомендуется)

### Установка Supabase CLI

```bash
npm install -g supabase
```

### Метод 1: Supabase CLI (Рекомендуется)

```bash
# 1. Авторизация
supabase login

# 2. Связывание с проектом
supabase link --project-ref your-project-ref

# 3. Выполнение миграций
supabase db push
```

### Метод 2: Bash скрипт

```bash
cd supabase
chmod +x run-migrations.sh
./run-migrations.sh
```

### Метод 3: SQL Editor

1. Откройте Supabase Dashboard → SQL Editor
2. Для каждого файла в `migrations/` (в алфавитном порядке):
   - Откройте файл в текстовом редакторе
   - Скопируйте содержимое
   - Вставьте в SQL Editor
   - Нажмите "Run"

## 📊 Список миграций

| # | Файл | Описание |
|---|------|----------|
| 1 | `20251124164911_create_core_schema.sql` | Основная схема: users, equipment, events и т.д. |
| 2 | `20251124172359_fix_users_rls_policy.sql` | Исправление RLS политик для users |
| 3 | `20251124174505_fix_rls_infinite_recursion.sql` | Исправление бесконечной рекурсии в RLS |
| 4 | `20251124174734_create_equipment_schema.sql` | Расширенная схема equipment |
| 5 | `20251124222357_update_equipment_schema_for_csv.sql` | Обновление для импорта из CSV |
| 6 | `20251127131804_update_events_schema_for_requirements.sql` | Добавление requirements в events |
| 7 | `20251127203603_remove_load_dates_from_events.sql` | Удаление load_in/out_date |
| 8 | `20251127204345_update_events_status_to_russian.sql` | Русские статусы |
| 9 | `20251127205419_create_budget_items_schema.sql` | Схема budget_items |
| 10 | `20251127205602_fix_budget_items_equipment_reference.sql` | Исправление FK |
| 11 | `20251127214850_add_exchange_rate_to_budget_items.sql` | Курс обмена |
| 12 | `20251130201008_create_personnel_schema.sql` | Таблица personnel |
| 13 | `20251130201025_create_work_items_schema.sql` | Таблица work_items |
| 14 | `20251130201115_update_budget_items_for_work_and_personnel.sql` | Связь с работами |
| 15 | `20251130202632_add_unique_constraint_to_work_items.sql` | Уникальность |
| 16 | `20251130203151_fix_budget_items_nullable_fields.sql` | Nullable поля |
| 17 | `20251201115703_create_categories_table.sql` | Таблица categories |
| 18 | `20251201120501_add_category_to_budget_items.sql` | Категории в budget_items |
| 19 | `20260106151652_add_equipment_type_fields.sql` | Поля type в equipment |
| 20 | `20260106153030_add_equipment_items_type_fields.sql` | Поля type в items |
| 21 | `20260106201111_create_equipment_compositions_table.sql` | Композиции |
| 22 | `20260106211732_add_sort_order_to_categories_and_budget_items.sql` | Сортировка |
| 23 | `20260107090832_create_payments_schema.sql` | Таблица payments |
| 24 | `20260107091054_create_payment_trigger_for_budget_items.sql` | Триггер payments |
| 25 | `20260107100751_fix_payment_trigger_for_personnel.sql` | Исправление триггера |
| 26 | `20260107134222_fix_payment_trigger_total_rub.sql` | Исправление total_rub |
| 27 | `20260107135033_fix_payment_trigger_event_date.sql` | Исправление event_date |
| 28 | `20260107194456_fix_personnel_rls_for_payments.sql` | RLS для personnel |
| 29 | `20260107200131_fix_personnel_rls_for_payments.sql` | Повторное исправление RLS |
| 30 | `20260108202855_fix_payment_duplication_and_add_work_item_link.sql` | Дубликаты payments |
| 31 | `20260112124516_create_templates_schema.sql` | Таблицы templates |
| 32 | `20260112181320_add_price_to_template_items.sql` | Цены в template_items |
| 33 | `20260127005511_create_warehouse_specification_items.sql` | Складские спецификации |
| 34 | `20260127013916_add_warehouse_role_to_users.sql` | Роль warehouse |
| 35 | `20260127160147_20260127_create_equipment_modifications.sql` | Таблица modifications |
| 36 | `20260127160158_20260127_add_modification_to_budget_items.sql` | Модификации в budget |
| 37 | `20260127160436_20260127_create_screen_with_modifications_example.sql` | Пример: экран |
| 38 | `20260127160446_20260127_add_suspension_modification_example.sql` | Пример: подвес |
| 39 | `20260127161456_20260127_add_screen_stands_components.sql` | Компоненты стойки |
| 40 | `20260127161505_20260127_add_screen_suspend_components.sql` | Компоненты подвеса |
| 41 | `20260127174846_fix_equipment_modifications_rls.sql` | RLS для modifications |
| 42 | `20260203110031_20260203_add_warehouse_other_items.sql` | Прочие складские позиции |

## ✅ Проверка выполнения

### Проверка таблиц

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

Ожидаемые таблицы:
- budget_items
- categories
- clients
- equipment
- equipment_compositions
- equipment_modifications
- events
- organizers
- payments
- personnel
- template_categories
- template_items
- templates
- users
- venues
- warehouse_specification_items
- work_items

### Проверка RLS

```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

Все таблицы должны иметь `rowsecurity = true`

### Проверка triggers

```sql
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
```

## 🔄 Создание новой миграции

### Формат имени файла

```
YYYYMMDDHHMMSS_description.sql
```

Пример: `20260204120000_add_new_feature.sql`

### Шаблон миграции

```sql
-- Description: Brief description of changes
-- Date: YYYY-MM-DD
-- Author: Your Name

-- Begin transaction (optional)
BEGIN;

-- Your changes here
ALTER TABLE table_name ADD COLUMN new_column text;

-- Update RLS policies if needed
DROP POLICY IF EXISTS "old_policy" ON table_name;
CREATE POLICY "new_policy" 
  ON table_name FOR SELECT
  TO authenticated
  USING (true);

-- Commit transaction
COMMIT;
```

### Добавление миграции

1. Создайте файл в `supabase/migrations/`
2. Напишите SQL код
3. Выполните миграцию через CLI или Dashboard
4. Зафиксируйте изменения в Git

## 🔧 Откат миграций

### Через Supabase CLI

```bash
# Просмотр истории
supabase migration list

# Откат к конкретной миграции
supabase db reset --db-url your-db-url
```

### Вручную

Создайте файл отката (reverse migration):

```sql
-- Rollback for: 20260204120000_add_new_feature.sql
ALTER TABLE table_name DROP COLUMN new_column;
```

## 📚 Дополнительная информация

- **Документация схемы**: См. [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- **Руководство по развертыванию**: См. [DEPLOYMENT.md](../DEPLOYMENT.md)
- **Supabase Docs**: https://supabase.com/docs/guides/cli

## 🆘 Решение проблем

### Ошибка: "relation already exists"

**Причина**: Таблица уже существует в базе данных

**Решение**: 
1. Используйте `CREATE TABLE IF NOT EXISTS`
2. Или удалите существующую таблицу (осторожно!)

### Ошибка: "infinite recursion detected in policy"

**Причина**: RLS политика ссылается сама на себя

**Решение**: Пересмотрите логику RLS политики, избегайте циклических зависимостей

### Ошибка: "permission denied"

**Причина**: Недостаточно прав для выполнения SQL

**Решение**: 
1. Используйте service_role key для админских операций
2. Проверьте RLS политики

## 🔐 Безопасность

⚠️ **Важно**:
- Никогда не коммитьте service_role key в Git
- Всегда используйте RLS для защиты данных
- Тестируйте миграции на staging окружении перед production
- Делайте резервные копии перед выполнением миграций

---

**Последнее обновление**: 04.02.2026  
**Версия**: 1.0
