BEGIN;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS project_details jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_project_details_object_check;
ALTER TABLE public.events ADD CONSTRAINT events_project_details_object_check CHECK (jsonb_typeof(project_details) = 'object');
COMMENT ON COLUMN public.events.project_details IS 'Event page: description, timing, participants, transport and technical notes';
NOTIFY pgrst, 'reload schema';
COMMIT;
