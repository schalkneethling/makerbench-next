CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = check_user_id
      AND role = 'admin'
  );
$$;
--> statement-breakpoint
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "bookmark owners can manage their bookmarks"
  ON public.bookmarks;
--> statement-breakpoint
CREATE POLICY "bookmark owners can manage their bookmarks"
  ON public.bookmarks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS "admins can view user roles"
  ON public.user_roles;
--> statement-breakpoint
CREATE POLICY "admins can view user roles"
  ON public.user_roles
  FOR SELECT
  USING (public.is_admin() OR auth.uid() = user_id);
--> statement-breakpoint
DROP POLICY IF EXISTS "admins can manage user roles"
  ON public.user_roles;
--> statement-breakpoint
CREATE POLICY "admins can manage user roles"
  ON public.user_roles
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
--> statement-breakpoint
DROP POLICY IF EXISTS "users can manage their preferences"
  ON public.user_preferences;
--> statement-breakpoint
CREATE POLICY "users can manage their preferences"
  ON public.user_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
