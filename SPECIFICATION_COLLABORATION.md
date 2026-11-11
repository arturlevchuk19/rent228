# Shared specification and activity history

Apply `20261111120000_main_specification_permissions.sql` before
`20261111130000_specification_collaboration_and_logs.sql`, then deploy the client.
The migrations have local PostgreSQL integration coverage; they do not backfill
historical actions or browser-only checkmarks.

All specification tabs store checkmarks on the server. Generated composition rows
use a guarded single-field RPC and a separate shared marks table, without changing
the main row's quantity or materializing its children. The offline outbox supports
this one idempotent RPC after the specification has been opened online.

The client subscribes to the five row tables and the current event budget through
Supabase Realtime. The migration adds them to the `supabase_realtime` publication
when it exists. Polling every 10 seconds while visible and refreshes on focus,
visibility and reconnect recover missed messages. Checkbox updates only merge
checkbox fields, preserving unsaved quantity/notes drafts. Structural changes
reload automatically when safe; otherwise the user sees a refresh notice.

Database triggers record committed insert/update/delete actions across the row
tables, shared marks, and specification state, with the authenticated actor's
name, row label, changed values and server timestamp. Repeated checkbox writes
that do not change a value do not create duplicate actions. Rejected/rolled-back
writes are not success events. Offline actions appear after server synchronization.

Only an active administrator, owner, or assigned site lead with specification view
access can read history. Authenticated clients cannot create or alter audit rows.
The Logs dialog loads 50 newest entries at a time and uses keyset pagination.

Validation:
- `npm run typecheck`, `npm run build`
- `node tests/specification-collaboration.test.mjs`
- `node tests/specification-realtime.test.mjs`
- `node tests/specification-permissions.test.mjs`
- `PGLITE_MODULE=<module URL for installed @electric-sql/pglite> node tests/specification-permissions.integration.mjs`
- With Vite running on 127.0.0.1:5173, Python Playwright and Chromium installed:
  `python tests/specification-collaboration.browser.py` and `python tests/offline.test.py`.
  Browser fixtures use mocked data and isolated contexts; no live database writes.
