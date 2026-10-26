-- Retire the review stage without incorrectly marking pending events as completed.
BEGIN;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;
UPDATE public.events SET status = 'Запрос' WHERE status = 'На рассмотрении';
ALTER TABLE public.events ADD CONSTRAINT events_status_check
  CHECK (status IN ('Запрос', 'Подтверждено', 'Отменено', 'Выполнено'));
COMMIT;
