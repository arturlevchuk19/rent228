# Инструкция по применению миграций БД

## Статус
Все 45 миграций собраны в файл `supabase/all_migrations_combined.sql` (2861 строк).

## Способы применения миграций

### Способ 1: Через Supabase Dashboard (рекомендуется)

1. Перейдите в Supabase Dashboard: https://supabase.com/dashboard/project/jtgupdeuwovoyadgtcns
2. В левом меню выберите **SQL Editor**
3. Нажмите **New Query**
4. Откройте файл `supabase/all_migrations_combined.sql` и скопируйте содержимое
5. Вставьте в редактор SQL
6. Нажмите **Run**

### Способ 2: Через Supabase CLI

```bash
# Установите Supabase CLI если ещё не установлен
npm install -g supabase

# Авторизуйтесь (откроется браузер)
supabase login

# Привяжите проект
supabase link --project-ref jtgupdeuwovoyadgtcns

# Примените миграции
supabase db push
```

### Способ 3: Через psql (требуется пароль от БД)

```bash
# Получите пароль от базы данных в Supabase Dashboard:
# Project Settings -> Database -> Connection string

# Выполните миграции
psql "postgresql://postgres:[PASSWORD]@db.jtgupdeuwovoyadgtcns.supabase.co:5432/postgres" -f supabase/all_migrations_combined.sql
```

## Список миграций (45 файлов)

| № | Файл | Описание |
|---|------|----------|
| 1 | 20251124164911_create_core_schema.sql | Базовая схема (users, equipment, events, etc.) |
| 2 | 20251124172359_fix_users_rls_policy.sql | Фикс RLS политик для users |
| 3 | 20251124174505_fix_rls_infinite_recursion.sql | Исправление рекурсии RLS |
| 4 | 20251124174734_create_equipment_schema.sql | Схема equipment (categories, items) |
| 5 | 20251124222357_update_equipment_schema_for_csv.sql | Обновление для CSV импорта |
| 6 | 20251127131804_update_events_schema_for_requirements.sql | Обновление events для требований |
| 7 | 20251127203603_remove_load_dates_from_events.sql | Удаление load dates |
| 8 | 20251127204345_update_events_status_to_russian.sql | Статусы на русском |
| 9 | 20251127205419_create_budget_items_schema.sql | Схема budget_items |
| 10 | 20251127205602_fix_budget_items_equipment_reference.sql | Фикс ссылок equipment |
| 11 | 20251127214850_add_exchange_rate_to_budget_items.sql | Добавление exchange_rate |
| 12 | 20251130201008_create_personnel_schema.sql | Схема personnel |
| 13 | 20251130201025_create_work_items_schema.sql | Схема work_items |
| 14 | 20251130201115_update_budget_items_for_work_and_personnel.sql | Обновление budget_items |
| 15 | 20251130202632_add_unique_constraint_to_work_items.sql | Unique constraint |
| 16 | 20251130203151_fix_budget_items_nullable_fields.sql | Nullable fields |
| 17 | 20251201115703_create_categories_table.sql | Таблица categories |
| 18 | 20251201120501_add_category_to_budget_items.sql | Category в budget_items |
| 19 | 20260106151652_add_equipment_type_fields.sql | Поля типа equipment |
| 20 | 20260106153030_add_equipment_items_type_fields.sql | Поля для items |
| 21 | 20260106201111_create_equipment_compositions_table.sql | Compositions таблица |
| 22 | 20260106211732_add_sort_order_to_categories_and_budget_items.sql | Sort order |
| 23 | 20260107090832_create_payments_schema.sql | Схема payments |
| 24 | 20260107091054_create_payment_trigger_for_budget_items.sql | Триггеры payments |
| 25 | 20260107100751_fix_payment_trigger_for_personnel.sql | Фикс триггеров personnel |
| 26 | 20260107134222_fix_payment_trigger_total_rub.sql | Фикс total_rub |
| 27 | 20260107135033_fix_payment_trigger_event_date.sql | Фикс event_date |
| 28 | 20260107194456_fix_personnel_rls_for_payments.sql | RLS для personnel |
| 29 | 20260107200131_fix_personnel_rls_for_payments.sql | Доп. фикс RLS |
| 30 | 20260108202855_fix_payment_duplication_and_add_work_item_link.sql | Фикс дубликации |
| 31 | 20260112124516_create_templates_schema.sql | Схема templates |
| 32 | 20260112181320_add_price_to_template_items.sql | Price в templates |
| 33 | 20260127005511_create_warehouse_specification_items.sql | Warehouse spec |
| 34 | 20260127013916_add_warehouse_role_to_users.sql | Warehouse роль |
| 35 | 20260127160147_20260127_create_equipment_modifications.sql | Equipment modifications |
| 36 | 20260127160158_20260127_add_modification_to_budget_items.sql | Modification в budget |
| 37 | 20260127160436_20260127_create_screen_with_modifications_example.sql | Пример screen |
| 38 | 20260127160446_20260127_add_suspension_modification_example.sql | Suspension пример |
| 39 | 20260127161456_20260127_add_screen_stands_components.sql | Screen stands |
| 40 | 20260127161505_20260127_add_screen_suspend_components.sql | Screen suspend |
| 41 | 20260127174846_fix_equipment_modifications_rls.sql | Фикс RLS modifications |
| 42 | 20260203110031_20260203_add_warehouse_other_items.sql | Warehouse other items |

## Примечания

- Проект: `cto.new` (jtgupdeuwovoyadgtcns)
- Регион: eu-west-1
- Статус: ACTIVE_HEALTHY

Если возникнут ошибки при применении отдельных миграций, их можно применять по одной из папки `supabase/migrations/`.
