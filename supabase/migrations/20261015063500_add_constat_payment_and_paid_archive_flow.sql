-- Enforce payment before archiving a completed work order.
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
    WHEN p_old = 'Travaux effectués' AND p_new = 'Payé' THEN true
    WHEN p_old = 'Payé' AND p_new = 'Archivé' THEN true
    ELSE false
  END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_constat_paid_for_work_order(
  p_work_order_id uuid,
  p_constat_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_constat public.constats%rowtype;
  v_os_status text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  SELECT * INTO v_constat
  FROM public.constats
  WHERE id = p_constat_id AND work_order_id = p_work_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Constat introuvable pour cet OS';
  END IF;
  IF v_constat.status NOT IN ('Validé','Validé avec réserve') THEN
    RAISE EXCEPTION 'Seul un constat validé peut être marqué payé (statut actuel : %)', coalesce(v_constat.status,'inconnu');
  END IF;

  SELECT status INTO v_os_status
  FROM public.work_orders
  WHERE id = p_work_order_id
  FOR UPDATE;

  IF v_os_status IS DISTINCT FROM 'Travaux effectués' THEN
    RAISE EXCEPTION 'Le paiement ne peut être enregistré que pour un OS au statut Travaux effectués (statut actuel : %)', coalesce(v_os_status,'inconnu');
  END IF;

  UPDATE public.constats
  SET status = 'Payé', updated_at = now()
  WHERE id = p_constat_id;

  UPDATE public.work_orders
  SET status = 'Payé', updated_by = p_user_id, updated_at = now()
  WHERE id = p_work_order_id;

  RETURN jsonb_build_object(
    'constat_id', p_constat_id,
    'constat_status', 'Payé',
    'work_order_status', 'Payé'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.archive_paid_work_order(
  p_work_order_id uuid,
  p_constat_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_constat public.constats%rowtype;
  v_os_status text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  SELECT * INTO v_constat
  FROM public.constats
  WHERE id = p_constat_id AND work_order_id = p_work_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Constat introuvable pour cet OS';
  END IF;
  IF v_constat.status <> 'Payé' THEN
    RAISE EXCEPTION 'L''archivage est interdit tant que le constat n''est pas payé.';
  END IF;

  SELECT status INTO v_os_status
  FROM public.work_orders
  WHERE id = p_work_order_id
  FOR UPDATE;

  IF v_os_status IS DISTINCT FROM 'Payé' THEN
    RAISE EXCEPTION 'L''OS doit être au statut Payé avant archivage (statut actuel : %)', coalesce(v_os_status,'inconnu');
  END IF;

  UPDATE public.constats
  SET status = 'Archivé', updated_at = now()
  WHERE id = p_constat_id;

  UPDATE public.work_orders
  SET status = 'Archivé', updated_by = p_user_id, updated_at = now()
  WHERE id = p_work_order_id;

  RETURN jsonb_build_object(
    'constat_id', p_constat_id,
    'constat_status', 'Archivé',
    'work_order_status', 'Archivé'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_constat_paid_for_work_order(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_constat_paid_for_work_order(uuid,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.archive_paid_work_order(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_paid_work_order(uuid,uuid,uuid) TO authenticated;
