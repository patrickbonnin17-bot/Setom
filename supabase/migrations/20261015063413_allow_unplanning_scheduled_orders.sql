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
    WHEN p_old = 'Planifié' AND p_new IN ('À planifier','Travaux en cours') THEN true
    WHEN p_old = 'Travaux en cours' AND p_new IN ('Travaux réalisés','À planifier') THEN true
    WHEN p_old = 'Travaux réalisés' AND p_new = 'Constat à vérifier' THEN true
    WHEN p_old = 'Constat à vérifier' AND p_new IN ('Constat validé','Travaux réalisés') THEN true
    WHEN p_old = 'Constat validé' AND p_new = 'Travaux effectués' THEN true
    WHEN p_old = 'Travaux effectués' AND p_new = 'Payé' THEN true
    WHEN p_old = 'Payé' AND p_new = 'Archivé' THEN true
    ELSE false
  END;
$function$;
