BEGIN;
-- A default moves existing personnel into the staff tab without replacing rows.
ALTER TABLE public.personnel
 ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'staff' CHECK (employment_type IN ('staff','freelance')),
 ADD COLUMN IF NOT EXISTS installation_rate numeric(12,2) NOT NULL DEFAULT 0 CHECK (installation_rate >= 0),
 ADD COLUMN IF NOT EXISTS warehouse_rate numeric(12,2) NOT NULL DEFAULT 0 CHECK (warehouse_rate >= 0);
COMMENT ON COLUMN public.personnel.installation_rate IS 'Installation/dismantling hourly rate, BYN/hour';
COMMENT ON COLUMN public.personnel.warehouse_rate IS 'Warehouse hourly rate, BYN/hour';
-- Keep legacy rate_percentage for historical budget payment calculations.
NOTIFY pgrst, 'reload schema';
COMMIT;
