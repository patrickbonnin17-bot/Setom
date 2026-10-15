-- Fix the photo guard for work_realizations.
-- This table references its OS through intervention_id; it has no work_order_id column.
CREATE OR REPLACE FUNCTION public.guard_work_realization_changes_without_photo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_work_order_id uuid;
BEGIN
  SELECT i.work_order_id
    INTO v_work_order_id
  FROM public.interventions AS i
  WHERE i.id = OLD.intervention_id;

  IF v_work_order_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.attachments AS a
    WHERE a.work_order_id = v_work_order_id
      AND a.category = 'travaux_realises'
      AND COALESCE(a.mime_type, '') LIKE 'image/%'
  ) THEN
    RAISE EXCEPTION 'Impossible de modifier ou supprimer les travaux réalisés sans photo des travaux réalisés.';
  END IF;

  RETURN OLD;
END;
$function$;
