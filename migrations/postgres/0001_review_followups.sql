DROP TRIGGER IF EXISTS update_resources_updated_at ON public.resources;
CREATE TRIGGER update_resources_updated_at
  BEFORE UPDATE ON public.resources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP INDEX IF EXISTS public.idx_resources_normalized_url;
DROP INDEX IF EXISTS public.idx_tool_listings_resource;

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resources are public"
  ON public.resources;

CREATE POLICY "resources are public"
  ON public.resources
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "resources are service-role write only"
  ON public.resources;

CREATE POLICY "resources are service-role write only"
  ON public.resources
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "tool listings are service-role write only"
  ON public.tool_listings;

CREATE POLICY "tool listings are service-role write only"
  ON public.tool_listings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.bookmarks
  DROP CONSTRAINT IF EXISTS bookmarks_parent_id_fkey;

DO $$
BEGIN
  ALTER TABLE public.bookmarks
    ADD CONSTRAINT bookmarks_parent_id_fkey
    FOREIGN KEY (parent_id)
    REFERENCES public.bookmarks(id)
    ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
