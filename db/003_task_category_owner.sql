-- Personal Task: create tasks without runtime lookups in schema auth.
-- This file has not been applied. Run it only after approval, and only in
-- neon-cordovan-zebra, the database connected to personal-task.
-- It does not grant schema auth, change table privileges, or edit Neon Auth.
-- The script is one transaction. If any statement fails, none of it is kept.
-- Running it again replaces the same function and policies.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_task_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.completed AND NEW.completed_at IS NULL THEN
    NEW.completed_at = now();
  END IF;

  IF NOT NEW.completed THEN
    NEW.completed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_task_owner() FROM PUBLIC, anonymous, authenticated;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

ALTER POLICY tasks_insert ON public.tasks
  WITH CHECK (
    user_id = auth.uid()
    AND (
      category_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.categories AS owned_category
        WHERE owned_category.id = category_id
          AND owned_category.user_id = auth.uid()
      )
    )
  );

ALTER POLICY tasks_update ON public.tasks
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      category_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.categories AS owned_category
        WHERE owned_category.id = category_id
          AND owned_category.user_id = auth.uid()
      )
    )
  );

COMMIT;
