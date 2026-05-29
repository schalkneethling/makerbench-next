-- Replace is_admin(uuid) with is_admin() so admin checks always use auth.uid()
-- and callers cannot probe other users' roles by passing a user id.
DROP POLICY IF EXISTS "approved public listings are public"
  ON public.public_listings;
--> statement-breakpoint
DROP POLICY IF EXISTS "owners and admins can delete public listings"
  ON public.public_listings;
--> statement-breakpoint
DROP POLICY IF EXISTS "owners and admins can update public listings"
  ON public.public_listings;
--> statement-breakpoint
DROP POLICY IF EXISTS "approved public stack items are public"
  ON public.public_stack_items;
--> statement-breakpoint
DROP POLICY IF EXISTS "owners and admins can delete public stack items"
  ON public.public_stack_items;
--> statement-breakpoint
DROP POLICY IF EXISTS "owners and admins can update public stack items"
  ON public.public_stack_items;
--> statement-breakpoint
DROP POLICY IF EXISTS "approved public stacks are public"
  ON public.public_stacks;
--> statement-breakpoint
DROP POLICY IF EXISTS "owners and admins can delete public stacks"
  ON public.public_stacks;
--> statement-breakpoint
DROP POLICY IF EXISTS "owners and admins can update public stacks"
  ON public.public_stacks;
--> statement-breakpoint
DROP POLICY IF EXISTS "admins and authenticated users can delete orphan resources"
  ON public.resources;
--> statement-breakpoint
DROP POLICY IF EXISTS "bookmark owners and admins can update resources"
  ON public.resources;
--> statement-breakpoint
DROP POLICY IF EXISTS "resource owners and public catalog can read resources"
  ON public.resources;
--> statement-breakpoint
DROP POLICY IF EXISTS "admins can view user roles"
  ON public.user_roles;
--> statement-breakpoint
DROP POLICY IF EXISTS "admins can manage user roles"
  ON public.user_roles;
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.is_admin(uuid);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
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
CREATE POLICY "approved public listings are public"
  ON public.public_listings
  FOR SELECT
  USING (
    status = 'approved'
    OR public.is_admin()
    OR submitted_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.bookmarks
      WHERE bookmarks.id = public_listings.submitted_by_bookmark_id
        AND bookmarks.user_id = auth.uid()
    )
  );
--> statement-breakpoint
CREATE POLICY "owners and admins can delete public listings"
  ON public.public_listings
  FOR DELETE
  USING (public.is_admin() OR submitted_by_user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "owners and admins can update public listings"
  ON public.public_listings
  FOR UPDATE
  USING (public.is_admin() OR submitted_by_user_id = auth.uid())
  WITH CHECK (public.is_admin() OR submitted_by_user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "approved public stack items are public"
  ON public.public_stack_items
  FOR SELECT
  USING (
    public.is_admin()
    OR (
      status = 'approved'
      AND EXISTS (
        SELECT 1
        FROM public.public_stacks
        WHERE public_stacks.id = public_stack_items.public_stack_id
          AND (
            public_stacks.status = 'approved'
            OR public.is_admin()
            OR public_stacks.owner_user_id = auth.uid()
          )
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.public_stacks
      WHERE public_stacks.id = public_stack_items.public_stack_id
        AND public_stacks.owner_user_id = auth.uid()
    )
  );
--> statement-breakpoint
CREATE POLICY "owners and admins can delete public stack items"
  ON public.public_stack_items
  FOR DELETE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.public_stacks
      WHERE public_stacks.id = public_stack_items.public_stack_id
        AND public_stacks.owner_user_id = auth.uid()
    )
  );
--> statement-breakpoint
CREATE POLICY "owners and admins can update public stack items"
  ON public.public_stack_items
  FOR UPDATE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.public_stacks
      WHERE public_stacks.id = public_stack_items.public_stack_id
        AND public_stacks.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.public_stacks
      WHERE public_stacks.id = public_stack_items.public_stack_id
        AND public_stacks.owner_user_id = auth.uid()
    )
  );
--> statement-breakpoint
CREATE POLICY "approved public stacks are public"
  ON public.public_stacks
  FOR SELECT
  USING (
    status = 'approved'
    OR public.is_admin()
    OR owner_user_id = auth.uid()
  );
--> statement-breakpoint
CREATE POLICY "owners and admins can delete public stacks"
  ON public.public_stacks
  FOR DELETE
  USING (public.is_admin() OR owner_user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "owners and admins can update public stacks"
  ON public.public_stacks
  FOR UPDATE
  USING (public.is_admin() OR owner_user_id = auth.uid())
  WITH CHECK (public.is_admin() OR owner_user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "admins and authenticated users can delete orphan resources"
  ON public.resources
  FOR DELETE
  USING (
    public.is_admin()
    OR (
      auth.uid() IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.bookmarks
        WHERE bookmarks.resource_id = resources.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.public_listings
        WHERE public_listings.resource_id = resources.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.public_stacks
        WHERE public_stacks.resource_id = resources.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.public_stack_items
        WHERE public_stack_items.resource_id = resources.id
      )
    )
  );
--> statement-breakpoint
CREATE POLICY "bookmark owners and admins can update resources"
  ON public.resources
  FOR UPDATE
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.bookmarks
      WHERE bookmarks.resource_id = resources.id
        AND bookmarks.user_id = auth.uid()
    )
  );
--> statement-breakpoint
CREATE POLICY "resource owners and public catalog can read resources"
  ON public.resources
  FOR SELECT
  USING (
    public.is_admin()
    OR (
      auth.uid() IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.bookmarks
        WHERE bookmarks.resource_id = resources.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.public_listings
        WHERE public_listings.resource_id = resources.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.public_stacks
        WHERE public_stacks.resource_id = resources.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.public_stack_items
        WHERE public_stack_items.resource_id = resources.id
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.bookmarks
      WHERE bookmarks.resource_id = resources.id
        AND bookmarks.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.public_listings
      WHERE public_listings.resource_id = resources.id
        AND public_listings.status = 'approved'
    )
    OR EXISTS (
      SELECT 1
      FROM public.public_stacks
      WHERE public_stacks.resource_id = resources.id
        AND public_stacks.status = 'approved'
    )
    OR EXISTS (
      SELECT 1
      FROM public.public_stack_items
      WHERE public_stack_items.resource_id = resources.id
        AND public_stack_items.status = 'approved'
    )
  );
--> statement-breakpoint
CREATE POLICY "admins can view user roles"
  ON public.user_roles
  FOR SELECT
  USING (public.is_admin() OR auth.uid() = user_id);
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
