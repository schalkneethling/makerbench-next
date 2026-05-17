-- https://www.postgresql.org/docs/current/pgtrgm.html
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
DROP INDEX IF EXISTS public.idx_public_listings_status;
--> statement-breakpoint
DROP INDEX IF EXISTS public.idx_public_stacks_status;
--> statement-breakpoint
DROP INDEX IF EXISTS public.idx_public_stack_items_status;
--> statement-breakpoint
CREATE INDEX idx_public_listings_status
  ON public.public_listings
  USING btree (status, created_at DESC);
--> statement-breakpoint
CREATE INDEX idx_public_stacks_status
  ON public.public_stacks
  USING btree (status, created_at DESC);
--> statement-breakpoint
CREATE INDEX idx_public_stack_items_status
  ON public.public_stack_items
  USING btree (status, created_at DESC);
--> statement-breakpoint
CREATE INDEX idx_public_listings_tags
  ON public.public_listings
  USING gin (tags);
--> statement-breakpoint
CREATE INDEX idx_public_stacks_tags
  ON public.public_stacks
  USING gin (tags);
--> statement-breakpoint
CREATE INDEX idx_public_stack_items_tags
  ON public.public_stack_items
  USING gin (tags);
--> statement-breakpoint
CREATE INDEX idx_public_listings_search
  ON public.public_listings
  USING gin ((page_title || ' ' || meta_description || ' ' || array_to_string(tags, ' ')) gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX idx_public_stacks_search
  ON public.public_stacks
  USING gin ((page_title || ' ' || meta_description || ' ' || array_to_string(tags, ' ')) gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX idx_public_stack_items_search
  ON public.public_stack_items
  USING gin ((page_title || ' ' || meta_description || ' ' || array_to_string(tags, ' ')) gin_trgm_ops);
