-- Atomic toggle for priority completion state in day_plans.priorities JSONB.
-- Avoids read-modify-write race condition when user rapidly taps checkboxes.
CREATE OR REPLACE FUNCTION toggle_priority_completed(
  p_user_id UUID,
  p_date DATE,
  p_rank INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  row_found BOOLEAN;
BEGIN
  UPDATE day_plans
  SET
    priorities = (
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN (elem->>'rank')::int = p_rank
          THEN jsonb_set(elem, '{completed}', to_jsonb(NOT (elem->>'completed')::boolean))
          ELSE elem
        END
        ORDER BY (elem->>'rank')::int
      ), '[]'::jsonb)
      FROM jsonb_array_elements(priorities) AS elem
    ),
    updated_at = now()
  WHERE user_id = p_user_id AND date = p_date;

  GET DIAGNOSTICS row_found = ROW_COUNT;
  RETURN row_found > 0;
END;
$$;

-- Atomic resolve for open threads in day_plans.open_threads JSONB.
CREATE OR REPLACE FUNCTION resolve_open_thread(
  p_user_id UUID,
  p_date DATE,
  p_thread_text TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  row_found BOOLEAN;
BEGIN
  UPDATE day_plans
  SET
    open_threads = (
      SELECT coalesce(jsonb_agg(
        CASE
          WHEN elem->>'text' = p_thread_text AND elem->>'status' = 'open'
          THEN elem || jsonb_build_object('status', 'resolved', 'resolved_at', now()::text)
          ELSE elem
        END
      ), '[]'::jsonb)
      FROM jsonb_array_elements(open_threads) AS elem
    ),
    updated_at = now()
  WHERE user_id = p_user_id AND date = p_date;

  GET DIAGNOSTICS row_found = ROW_COUNT;
  RETURN row_found > 0;
END;
$$;
