# Several budgets for one event

The event page lists independently named budgets and one warehouse specification per budget. Existing rows, pricing settings, shipment flags, categories and locations are migrated into **Основная смета**. Existing item IDs and parent/child links are preserved.

Each budget has its own items, prices, discounts, budget days, note, templates, categories, locations, export settings and warehouse snapshot. Shipment and return flags are stored per specification. Personnel assignments remain attached to their original budget item IDs. The event's people/equipment summary includes all budgets.

Project progress appears directly below the venue. “Смета составлена” follows the existence of budgets, including clearing after the last deletion. Confirmation follows status Подтверждено/Выполнено; completion follows Выполнено. The confirmation and completion checkboxes change the status in reverse. Payment remains manually editable. Database triggers keep the derived flags consistent after inserts, deletions and status updates.

## Database update

After the earlier account/role migration, run `supabase/migrations/20261029020000_event_budgets.sql` in the Supabase SQL Editor. It runs in a transaction, preserves existing records, adds `event_budgets`, scoped foreign keys, access policies and progress triggers. Apply it once. The migration was tested on disposable PostgreSQL 16, but has not been applied to the production project from this session.

The previous `20261029010000_exclude_specification_children.sql` is still needed for persisting excluded calculated child rows. The new migration includes the updated atomic component/case replacement function, scoped to the source specification.

Deploy the frontend after the database update. Without this migration the UI reports the missing migration and does not mix budgets as a fallback.

## Validation

- `npm run typecheck`, `npm run build`, `npm run test:event-project`.
- `node tests/event-budgets.test.mjs`: scoped queries, exchange rates, snapshots, progress.
- In a **new disposable database only**: run `tests/event-budgets.bootstrap.sql`, then the migration, then `tests/event-budgets.integration.sql`. The fixture creates test roles/tables; never run it on the application database.
- Chromium check with intercepted fixture responses: mobile layout, two documents, scoped editor/specification requests, status progress, last-budget deletion and no runtime errors. No production data was read or written.
