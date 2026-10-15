ALTER TABLE public.constats
  ADD COLUMN IF NOT EXISTS reserve_reason text,
  ADD COLUMN IF NOT EXISTS reserve_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS reserve_resolved_by uuid;

CREATE OR REPLACE FUNCTION public.mark_constat_with_reserve(
  p_work_order_id uuid,
  p_constat_id uuid,
  p_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_constat public.constats%rowtype;
  v_os_status text;
  v_reason text := NULLIF(BTRIM(p_reason), '');
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Le motif de la réserve est obligatoire.';
  END IF;

  SELECT * INTO v_constat
  FROM public.constats
  WHERE id = p_constat_id AND work_order_id = p_work_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Constat introuvable pour cet OS';
  END IF;
  IF v_constat.status <> 'Validé' THEN
    RAISE EXCEPTION 'Seul un constat validé sans réserve peut recevoir un retour en réserve.';
  END IF;

  SELECT status INTO v_os_status
  FROM public.work_orders
  WHERE id = p_work_order_id
  FOR UPDATE;
  IF v_os_status IS DISTINCT FROM 'Travaux effectués' THEN
    RAISE EXCEPTION 'Le retour en réserve est disponible uniquement après transmission du constat et passage de l''OS à Travaux effectués.';
  END IF;

  UPDATE public.constats
  SET status = 'Validé avec réserve',
      reserved_at = now(),
      reserve_reason = v_reason,
      reserve_resolved_at = NULL,
      reserve_resolved_by = NULL,
      updated_at = now()
  WHERE id = p_constat_id;

  RETURN jsonb_build_object(
    'constat_id', p_constat_id,
    'constat_status', 'Validé avec réserve',
    'reserve_reason', v_reason,
    'reserve_resolved_at', NULL,
    'work_order_status', v_os_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_constat_reserve(
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
  v_resolved_at timestamptz := now();
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
  IF v_constat.status <> 'Validé avec réserve' THEN
    RAISE EXCEPTION 'Ce constat ne porte pas de réserve à lever.';
  END IF;
  IF v_constat.reserve_resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cette réserve est déjà marquée comme levée.';
  END IF;

  SELECT status INTO v_os_status
  FROM public.work_orders
  WHERE id = p_work_order_id
  FOR UPDATE;
  IF v_os_status IS DISTINCT FROM 'Travaux effectués' THEN
    RAISE EXCEPTION 'La levée de réserve doit être enregistrée avant le paiement et l''archivage.';
  END IF;

  UPDATE public.constats
  SET reserve_resolved_at = v_resolved_at,
      reserve_resolved_by = p_user_id,
      updated_at = v_resolved_at
  WHERE id = p_constat_id;

  RETURN jsonb_build_object(
    'constat_id', p_constat_id,
    'constat_status', 'Validé avec réserve',
    'reserve_resolved_at', v_resolved_at,
    'work_order_status', v_os_status
  );
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
  IF v_constat.status = 'Validé avec réserve' AND v_constat.reserve_resolved_at IS NULL THEN
    RAISE EXCEPTION 'Le paiement est bloqué tant que la réserve n''est pas levée.';
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

REVOKE ALL ON FUNCTION public.mark_constat_with_reserve(uuid,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_constat_with_reserve(uuid,uuid,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.resolve_constat_reserve(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_constat_reserve(uuid,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.mark_constat_paid_for_work_order(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_constat_paid_for_work_order(uuid,uuid,uuid) TO authenticated;
