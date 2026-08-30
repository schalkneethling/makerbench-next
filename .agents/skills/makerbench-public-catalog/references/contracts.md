# Public catalog routing

Public listing work uses strict Valibot parsing and approved-only category queries. Preserve Tool contracts while routing Resource and Article listing, tag, moderation, and submission changes through maintained API and client boundaries. Exclude Stack data from every public response while retaining stored/admin data; catalog classification may change only Resource ↔ Article.

Resource and Article pagination uses `limit + 1`, `total: null`, and no count, Stack, or stack-child query. Listing hooks issue one initial request, abort and invalidate request IDs on cleanup, preserve all parameters during load-more, and defer facets without allowing stale updates.

For metadata, screenshots, or any user-controlled server-side URL, reuse the shared public-URL resolver and dispatcher. Preserve bounded timeouts, redirect and connection-time DNS revalidation, public-address enforcement, pre-DNS feature-scoped rate limiting, request-scoped dispatcher cleanup, and fail-closed errors.

Cache headers and tags apply only to eligible, successful, unfiltered public responses and require invalidation coverage. Admin and private-library caches follow their own contracts.

Masonry is for public browse and library collections; administrative workflows remain semantic lists. Capture production performance evidence only through the sanitized performance scripts.
