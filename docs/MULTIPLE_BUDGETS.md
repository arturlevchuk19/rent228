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

## Copying and names

Apply `20261029030000_copy_event_budget.sql` after the multi-budget migration. Copying always creates a new budget, including when the source belongs to the same event. Existing budgets are never used as copy targets. The source's pricing settings, item hierarchy, categories and locations are copied atomically; warehouse snapshots and shipment marks start fresh. Any error rolls the operation back.

Use **Название** in a budget row to edit its name inline. Enter or the checkmark saves; Escape or the cross cancels. Renaming does not submit the event form and preserves the budget/specification identity.

`tests/event-budget-copy.integration.sql` exercises copying after the disposable bootstrap and both migrations: a new document, unchanged existing records, settings and parent/child links, independent catalogs, rename, failure rollback and access restrictions.

## Event-page documents

The bottom legacy toolbar in the budget section is removed. The event header contains **PDF** followed by **Договор**, plus copy and delete actions. PDF exports the warehouse specification as an A4 table (equipment including calculated children and exclusions, cables, connectors and other items), with embedded Cyrillic fonts, repeated headings and numbered pages. It contains names, quantities, units and notes without an SKU column or budget prices. One specification downloads directly; several open a name chooser. Contracts also ask for a budget when more than one exists.

`node tests/specification-pdf.test.mjs` verifies composition expansion, exclusions, accessory totals, scoped loading, embedded fonts and multiple pages. Browser verification downloaded two independently scoped PDFs and confirmed the chooser, direct single-spec export and mobile layout. No additional database migration is needed for this toolbar/PDF change.
