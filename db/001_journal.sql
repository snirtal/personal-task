-- Personal Task application tables.
-- This file has not been applied. Do not run it until the schema is approved.
-- Run it only in the neon-cordovan-zebra database connected to personal-task.
-- It does not create, alter, or delete Neon Auth tables. It only references neon_auth."user".
-- Verified live schema: neon_auth."user".id is uuid, and auth.uid() returns uuid.
-- The script is one transaction. If any statement fails, none of it is kept.
-- After applying, refresh the Data API schema cache in the Neon console.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_task_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'task owner mismatch' USING ERRCODE = '42501';
  END IF;

  IF NEW.category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.categories
    WHERE id = NEW.category_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'category is not available' USING ERRCODE = '42501';
  END IF;

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

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES neon_auth."user" (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES neon_auth."user" (id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories (id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  due_date date,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TRIGGER tasks_enforce_owner
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_owner();

CREATE INDEX tasks_user_id_idx ON public.tasks (user_id);
CREATE INDEX tasks_user_due_idx ON public.tasks (user_id, due_date);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

CREATE POLICY categories_select ON public.categories
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY categories_insert ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY categories_update ON public.categories
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY categories_delete ON public.categories
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.categories FROM PUBLIC, anonymous, authenticated;
REVOKE ALL ON TABLE public.tasks FROM PUBLIC, anonymous, authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT (id, user_id, name, created_at) ON public.categories TO authenticated;
GRANT INSERT (name) ON public.categories TO authenticated;
GRANT UPDATE (name) ON public.categories TO authenticated;
GRANT DELETE ON public.categories TO authenticated;

GRANT SELECT (id, user_id, category_id, title, note, due_date, priority, completed, created_at, completed_at)
  ON public.tasks TO authenticated;
GRANT INSERT (id, category_id, title, note, due_date, priority, completed, completed_at)
  ON public.tasks TO authenticated;
GRANT UPDATE (category_id, title, note, due_date, priority, completed, completed_at)
  ON public.tasks TO authenticated;
GRANT DELETE ON public.tasks TO authenticated;

COMMIT;
