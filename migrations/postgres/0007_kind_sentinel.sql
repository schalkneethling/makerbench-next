ALTER TABLE "public_listings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public_stack_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public_stacks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tool_listings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "resources are public"
  ON public.resources;--> statement-breakpoint
DROP POLICY IF EXISTS "resource owners and public catalog can read resources"
  ON public.resources;--> statement-breakpoint
CREATE POLICY "resource owners and public catalog can read resources"
  ON public.resources
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tool_listings
      WHERE tool_listings.resource_id = resources.id
        AND tool_listings.status = 'approved'
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
      INNER JOIN public.public_stacks
        ON public_stacks.id = public_stack_items.public_stack_id
      WHERE public_stack_items.resource_id = resources.id
        AND public_stack_items.status = 'approved'
        AND public_stacks.status = 'approved'
    )
    OR EXISTS (
      SELECT 1
      FROM public.bookmarks
      WHERE bookmarks.resource_id = resources.id
        AND bookmarks.user_id = auth.uid()
    )
  );--> statement-breakpoint
DROP POLICY IF EXISTS "authenticated users can create resources"
  ON public.resources;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.resources
  FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON TABLE public.resources
  TO anon, authenticated;
