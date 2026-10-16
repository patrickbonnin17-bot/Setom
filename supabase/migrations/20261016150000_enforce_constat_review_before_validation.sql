CREATE OR REPLACE FUNCTION public.validate_constat_for_work_order(p_work_order_id uuid, p_constat_id uuid, p_user_id uuid)
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

  IF public.setom_current_role() NOT IN ('admin','bureau','eau_de_toulouse') THEN
    RAISE EXCEPTION 'Votre profil ne permet pas de valider ce constat.';
  END IF;

  IF NOT public.setom_can_access_work_order(p_work_order_id) THEN
    RAISE EXCEPTION 'Cet OS n’est pas accessible à votre compte.';
  END IF;

  SELECT status INTO v_os_status
  FROM public.work_orders
  WHERE id = p_work_order_id
  FOR UPDATE;

  IF v_os_status IS DISTINCT FROM 'Constat à vérifier' THEN
    RAISE EXCEPTION 'Validation impossible : le constat doit d’abord être vérifié. Statut actuel de l’OS : %', COALESCE(v_os_status,'inconnu');
  END IF;

  SELECT * INTO v_constat
  FROM public.constats
  WHERE id = p_constat_id AND work_order_id = p_work_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Constat introuvable pour cet OS';
  END IF;

  IF v_constat.status NOT IN ('Brouillon','À vérifier','À valider') THEN
    RAISE EXCEPTION 'Le constat est déjà validé ou ne peut plus être validé (statut : %)', COALESCE(v_constat.status,'inconnu');
  END IF;

  UPDATE public.constats
  SET status = 'Validé',
      validated_at = now(),
      validated_by = p_user_id,
      updated_at = now()
  WHERE id = p_constat_id;

  UPDATE public.work_orders
  SET status = 'Constat validé',
      updated_by = p_user_id,
      updated_at = now()
  WHERE id = p_work_order_id;

  UPDATE public.work_orders
  SET status = 'Travaux effectués',
      updated_by = p_user_id,
      updated_at = now()
  WHERE id = p_work_order_id;

  RETURN jsonb_build_object(
    'constat_id', p_constat_id,
    'constat_status', 'Validé',
    'work_order_status', 'Travaux effectués'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_constat_for_work_order(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_constat_for_work_order(uuid,uuid,uuid) TO authenticated;
