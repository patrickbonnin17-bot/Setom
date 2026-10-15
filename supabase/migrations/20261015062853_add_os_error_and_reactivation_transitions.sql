-- Allow active work orders to be reported in error and safely returned to planning.
CREATE OR REPLACE FUNCTION public.setom_is_valid_status_transition(p_old text, p_new text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT CASE
    WHEN p_old IS NULL THEN p_new IN ('À planifier','Planifié')
    WHEN p_old = p_new THEN true
    WHEN p_old IN ('À planifier','Planifié','Travaux en cours') AND p_new = 'En erreur' THEN true
    WHEN p_old = 'En erreur' AND p_new IN ('À planifier','Planifié') THEN true
    WHEN p_old = 'À planifier' AND p_new = 'Planifié' THEN true
    WHEN p_old = 'Planifié' AND p_new = 'Travaux en cours' THEN true
    WHEN p_old = 'Travaux en cours' AND p_new IN ('Travaux réalisés','À planifier') THEN true
    WHEN p_old = 'Travaux réalisés' AND p_new = 'Constat à vérifier' THEN true
    WHEN p_old = 'Constat à vérifier' AND p_new IN ('Constat validé','Travaux réalisés') THEN true
    WHEN p_old = 'Constat validé' AND p_new = 'Travaux effectués' THEN true
    WHEN p_old = 'Travaux effectués' AND p_new IN ('Archivé','Travaux effectués') THEN true
    ELSE false
  END;
$function$;

-- Store the error reason in the existing OS status history for auditability.
CREATE OR REPLACE FUNCTION public.log_work_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF tg_op = 'INSERT' THEN
    INSERT INTO public.status_history(work_order_id, new_status, reason, created_by)
    VALUES (
      new.id,
      new.status,
      CASE WHEN new.status = 'En erreur' THEN NULLIF(BTRIM(new.suspension_reason), '') ELSE NULL END,
      auth.uid()
    );
  ELSIF old.status IS DISTINCT FROM new.status THEN
    INSERT INTO public.status_history(work_order_id, old_status, new_status, reason, created_by)
    VALUES (
      new.id,
      old.status,
      new.status,
      CASE WHEN new.status = 'En erreur' THEN NULLIF(BTRIM(new.suspension_reason), '') ELSE NULL END,
      auth.uid()
    );
  END IF;
  RETURN new;
END;
$function$;
