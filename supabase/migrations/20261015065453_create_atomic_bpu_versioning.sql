CREATE OR REPLACE FUNCTION public.create_bpu_version_from_current(
  p_version_name text,
  p_valid_from date,
  p_notes text,
  p_user_id uuid,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_current public.bpu_versions%rowtype;
  v_new_version public.bpu_versions%rowtype;
  v_item jsonb;
  v_count integer := 0;
  v_name text := NULLIF(BTRIM(p_version_name), '');
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Seul un administrateur peut créer une version du bordereau de prix.';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Le nom de la nouvelle version est obligatoire.';
  END IF;
  IF p_valid_from IS NULL THEN
    RAISE EXCEPTION 'La date de validité est obligatoire.';
  END IF;
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Les lignes du BPU doivent être transmises sous forme de tableau.';
  END IF;

  v_count := jsonb_array_length(p_lines);
  IF v_count < 1 OR v_count > 1000 THEN
    RAISE EXCEPTION 'Une version du BPU doit contenir entre 1 et 1000 lignes.';
  END IF;

  SELECT * INTO v_current
  FROM public.bpu_versions
  WHERE is_current = true
  ORDER BY imported_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_current.id IS NOT NULL AND p_valid_from <= COALESCE(v_current.valid_from, DATE '0001-01-01') THEN
    RAISE EXCEPTION 'La date de début doit être postérieure à celle de la version actuelle (%).', v_current.valid_from;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    IF NULLIF(BTRIM(v_item->>'designation'), '') IS NULL THEN
      RAISE EXCEPTION 'Chaque ligne doit avoir une désignation.';
    END IF;
    IF NULLIF(BTRIM(v_item->>'unit'), '') IS NULL THEN
      RAISE EXCEPTION 'Chaque ligne doit avoir une unité.';
    END IF;
    IF COALESCE((v_item->>'unit_price')::numeric, -1) < 0 THEN
      RAISE EXCEPTION 'Les prix unitaires doivent être nuls ou positifs.';
    END IF;
    IF NULLIF(v_item->>'price_le_8_m2','') IS NOT NULL AND (v_item->>'price_le_8_m2')::numeric < 0 THEN
      RAISE EXCEPTION 'Les tarifs jusqu''à 8 m² doivent être positifs ou nuls.';
    END IF;
    IF NULLIF(v_item->>'price_8_15_m2','') IS NOT NULL AND (v_item->>'price_8_15_m2')::numeric < 0 THEN
      RAISE EXCEPTION 'Les tarifs de 8 à 15 m² doivent être positifs ou nuls.';
    END IF;
    IF NULLIF(v_item->>'price_gt_15_m2','') IS NOT NULL AND (v_item->>'price_gt_15_m2')::numeric < 0 THEN
      RAISE EXCEPTION 'Les tarifs au-delà de 15 m² doivent être positifs ou nuls.';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT NULLIF(BTRIM(value->>'code'), '') AS code, count(*) AS n
      FROM jsonb_array_elements(p_lines)
      GROUP BY NULLIF(BTRIM(value->>'code'), '')
    ) d
    WHERE d.code IS NOT NULL AND d.n > 1
  ) THEN
    RAISE EXCEPTION 'Un même code BPU ne peut pas apparaître deux fois dans une version.';
  END IF;

  INSERT INTO public.bpu_versions(version_name, valid_from, valid_to, is_current, created_by, notes)
  VALUES (v_name, p_valid_from, NULL, true, p_user_id, NULLIF(BTRIM(p_notes), ''))
  RETURNING * INTO v_new_version;

  INSERT INTO public.bpu_lines(
    version_id, code, designation, unit, unit_price, trade, material, active,
    price_le_8_m2, price_8_15_m2, price_gt_15_m2
  )
  SELECT
    v_new_version.id,
    NULLIF(BTRIM(item->>'code'), ''),
    BTRIM(item->>'designation'),
    BTRIM(item->>'unit'),
    COALESCE(NULLIF(item->>'unit_price','')::numeric, 0),
    NULLIF(BTRIM(item->>'trade'), ''),
    NULLIF(BTRIM(item->>'material'), ''),
    COALESCE((item->>'active')::boolean, true),
    NULLIF(item->>'price_le_8_m2','')::numeric,
    NULLIF(item->>'price_8_15_m2','')::numeric,
    NULLIF(item->>'price_gt_15_m2','')::numeric
  FROM jsonb_array_elements(p_lines) AS item;

  IF v_current.id IS NOT NULL THEN
    UPDATE public.bpu_versions
    SET is_current = false,
        valid_to = p_valid_from - 1,
        notes = CASE
          WHEN NULLIF(BTRIM(p_notes), '') IS NOT NULL
          THEN COALESCE(notes || E'\n', '') || 'Version remplacée par ' || v_name
          ELSE COALESCE(notes, 'Version clôturée')
        END
    WHERE id = v_current.id;
  END IF;

  RETURN jsonb_build_object(
    'version_id', v_new_version.id,
    'version_name', v_new_version.version_name,
    'valid_from', v_new_version.valid_from,
    'line_count', v_count,
    'previous_version_id', v_current.id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_bpu_version_from_current(text,date,text,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_bpu_version_from_current(text,date,text,uuid,jsonb) TO authenticated;
