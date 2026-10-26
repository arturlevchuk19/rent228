-- Remove the organizer directory and event association.
-- This permanently deletes all organizer records.
BEGIN;
ALTER TABLE public.events DROP COLUMN IF EXISTS organizer_id;
DROP TABLE IF EXISTS public.organizers;
NOTIFY pgrst, 'reload schema';
COMMIT;
