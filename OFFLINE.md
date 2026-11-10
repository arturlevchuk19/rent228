# Offline support

Production builds precache the application shell and lazy-loaded sections via a service worker (HTTPS or localhost required). After an online visit, the shell can reload without a network connection.

Successful Supabase REST reads are stored in IndexedDB, isolated by authenticated user ID. Up to 300 query responses are retained per account. Offline reads require an exact previously cached query. External images, uploads, authentication endpoints and RPCs are not cached.

PATCH and DELETE requests targeting a single cached row by `id=eq.…` are persisted in an ordered outbox and reflected in cached responses. Administrative user/role changes, inserts, bulk operations, uploads and RPCs require a connection. These return an explicit error offline. An active saved session is required; new logins require internet access.

The outbox is replayed with the current account's token on reconnect, focus, every 30 seconds while the app is open, or using the retry button. Web Locks coordinate tabs. Entries are removed only after successful server acknowledgement. Authorization failures stop the queue and are shown in the status banner. Signing out keeps the queue on this browser for the same account's next session. Do not clear browser site data before synchronization.

Changes apply in queue order. PATCH replay changes only submitted fields; concurrent server edits to those same fields use the last successfully applied value. There is no automatic conflict merge or background synchronization while the app is closed. Deletes are idempotent. Queue replay cannot bypass server row-level security. A server-side rejection blocks subsequent edits until the underlying issue is resolved; no UI for discarding individual queued edits is implemented.

Validation:
- `npm run typecheck`
- `npm run build`
- `npm run dev -- --host 127.0.0.1`, then `python tests/offline.test.py` with Python Playwright and Chromium installed. The browser test uses mocked requests and real IndexedDB; it does not write to a live database.
