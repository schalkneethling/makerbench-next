CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  normalized_url TEXT NOT NULL UNIQUE,
  canonical_url TEXT NOT NULL,
  page_title TEXT NOT NULL,
  meta_description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tool_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  page_title TEXT NOT NULL,
  meta_description TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  image_source TEXT CHECK (image_source IN ('og', 'screenshot', 'fallback')),
  submitter_name TEXT,
  submitter_github_url TEXT,
  metadata TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_tool_listing_resource UNIQUE (resource_id)
);

CREATE INDEX IF NOT EXISTS idx_tool_listings_status_created
  ON public.tool_listings(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_resources_updated_at ON public.resources;
CREATE TRIGGER update_resources_updated_at
  BEFORE UPDATE ON public.resources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tool_listings_updated_at ON public.tool_listings;
CREATE TRIGGER update_tool_listings_updated_at
  BEFORE UPDATE ON public.tool_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tool_listings ENABLE ROW LEVEL SECURITY;
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

DROP POLICY IF EXISTS "approved tool listings are public"
  ON public.tool_listings;

CREATE POLICY "approved tool listings are public"
  ON public.tool_listings
  FOR SELECT
  USING (status = 'approved');

DROP POLICY IF EXISTS "tool listings are service-role write only"
  ON public.tool_listings;

CREATE POLICY "tool listings are service-role write only"
  ON public.tool_listings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
