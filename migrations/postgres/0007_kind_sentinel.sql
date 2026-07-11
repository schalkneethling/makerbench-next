ALTER TABLE "public_listings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public_stack_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public_stacks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tool_listings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "authenticated users can create resources"
  ON public.resources;--> statement-breakpoint
CREATE POLICY "authenticated users can create resources"
  ON public.resources
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
