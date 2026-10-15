ALTER TABLE public.app_settings
  ALTER COLUMN standard_delay_days SET DEFAULT 25;

UPDATE public.app_settings
SET standard_delay_days = 25,
    updated_at = now();

ALTER TABLE public.work_orders
  ALTER COLUMN deadline_date DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.set_work_order_deadline_from_settings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_delay integer;
BEGIN
  IF NEW.deadline_date IS NULL THEN
    SELECT COALESCE(
      (SELECT s.standard_delay_days FROM public.app_settings s ORDER BY s.created_at DESC LIMIT 1),
      25
    ) INTO v_delay;

    NEW.deadline_date := COALESCE(NEW.creation_date, CURRENT_DATE) + GREATEST(COALESCE(v_delay, 25), 0);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_work_order_deadline_settings ON public.work_orders;
CREATE TRIGGER trg_work_order_deadline_settings
BEFORE INSERT ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_work_order_deadline_from_settings();
