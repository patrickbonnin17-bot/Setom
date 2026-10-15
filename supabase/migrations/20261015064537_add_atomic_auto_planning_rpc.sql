CREATE OR REPLACE FUNCTION public.apply_setom_planning_batch(
  p_assignments jsonb,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_item jsonb;
  v_order public.work_orders%rowtype;
  v_work_order_id uuid;
  v_intervention_id uuid;
  v_team_id uuid;
  v_plan_date date;
  v_plan_order integer;
  v_planned_count integer := 0;
  v_seen uuid[] := ARRAY[]::uuid[];
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;
  IF jsonb_typeof(p_assignments) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'La liste de planification doit être un tableau JSON.';
  END IF;
  IF jsonb_array_length(p_assignments) = 0 THEN
    RAISE EXCEPTION 'Aucun OS à planifier.';
  END IF;
  IF jsonb_array_length(p_assignments) > 200 THEN
    RAISE EXCEPTION 'Une planification automatique ne peut traiter que 200 OS à la fois.';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_assignments)
  LOOP
    v_work_order_id := NULLIF(v_item->>'work_order_id','')::uuid;
    v_intervention_id := NULLIF(v_item->>'intervention_id','')::uuid;
    v_team_id := NULLIF(v_item->>'team_id','')::uuid;
    v_plan_date := NULLIF(v_item->>'planned_date','')::date;
    v_plan_order := NULLIF(v_item->>'planned_order','')::integer;

    IF v_work_order_id IS NULL OR v_team_id IS NULL OR v_plan_date IS NULL OR v_plan_order IS NULL OR v_plan_order < 1 THEN
      RAISE EXCEPTION 'Une affectation de planning est incomplète ou invalide.';
    END IF;
    IF v_work_order_id = ANY(v_seen) THEN
      RAISE EXCEPTION 'Un même OS apparaît plusieurs fois dans la planification automatique.';
    END IF;
    v_seen := array_append(v_seen, v_work_order_id);

    SELECT * INTO v_order
    FROM public.work_orders
    WHERE id = v_work_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'OS introuvable : %', v_work_order_id;
    END IF;
    IF v_order.status NOT IN ('À planifier','Planifié') THEN
      RAISE EXCEPTION 'L''OS % n''est plus planifiable (statut : %).', v_order.os_number, v_order.status;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = v_team_id AND t.active = true
    ) THEN
      RAISE EXCEPTION 'L''équipe sélectionnée est introuvable ou inactive.';
    END IF;

    IF v_intervention_id IS NOT NULL THEN
      SELECT i.id INTO v_intervention_id
      FROM public.interventions i
      WHERE i.id = v_intervention_id AND i.work_order_id = v_work_order_id
      FOR UPDATE;
    END IF;

    IF v_intervention_id IS NULL THEN
      SELECT i.id INTO v_intervention_id
      FROM public.interventions i
      WHERE i.work_order_id = v_work_order_id
      ORDER BY (i.planned_date IS NOT NULL) DESC, i.updated_at DESC
      LIMIT 1
      FOR UPDATE;
    END IF;

    IF v_intervention_id IS NULL THEN
      INSERT INTO public.interventions(
        work_order_id, type, status, planned_date, planned_surface_m2,
        team_id, planned_order, updated_at
      ) VALUES (
        v_work_order_id, COALESCE(NULLIF(v_order.material_detail,''),'Intervention'),
        'Planifié', v_plan_date, v_order.planned_surface_m2,
        v_team_id, v_plan_order, now()
      );
    ELSE
      UPDATE public.interventions
      SET status = 'Planifié',
          planned_date = v_plan_date,
          planned_surface_m2 = COALESCE(v_order.planned_surface_m2, planned_surface_m2),
          team_id = v_team_id,
          planned_order = v_plan_order,
          updated_at = now()
      WHERE id = v_intervention_id;
    END IF;

    UPDATE public.work_orders
    SET status = 'Planifié', updated_by = p_user_id, updated_at = now()
    WHERE id = v_work_order_id;

    v_planned_count := v_planned_count + 1;
  END LOOP;

  RETURN jsonb_build_object('planned_count', v_planned_count);
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_setom_planning_batch(jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_setom_planning_batch(jsonb,uuid) TO authenticated;
