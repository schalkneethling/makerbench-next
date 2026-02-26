# MakerBench Architecture

Last updated: February 26, 2026

## Purpose

This document is the canonical technical reference for how MakerBench works today and what is planned next.

## System Context

```mermaid
flowchart LR
    U["User Browser (React App)"] --> N["Netlify Functions API"]
    N --> T["Turso (libSQL) via Drizzle"]
    N --> W["External Website (metadata fetch)"]
    N --> B["Browserless Screenshot API"]
    N --> C["Cloudinary Image Storage"]
    N --> S["Sentry (optional)"]
```

## Runtime Components

- Frontend app: React 19 + TypeScript + Vite
- API layer: Netlify Functions in `netlify/functions`
- Database access: Drizzle ORM + Turso via `netlify/functions/lib/db.ts`
- Validation: Zod schemas in `src/lib/validation.ts`
- External integrations:
  - Metadata fetch + parsing (Cheerio)
  - Browserless screenshot fallback
  - Cloudinary upload for generated screenshots

## Data Model

Primary tables:

- `bookmarks`
  - includes `status` (`pending | approved | rejected`)
  - includes `imageUrl`, `imageSource`, submitter metadata fields
- `tags`
- `bookmark_tags`
  - many-to-many join
  - unique constraint on (`bookmarkId`, `tagId`)

## API Surface

- `POST /api/bookmarks`
  - validates input
  - extracts metadata
  - tries screenshot fallback if no OG image
  - writes bookmark as `pending`
- `GET /api/bookmarks`
  - returns paginated `approved` bookmarks
- `GET /api/bookmarks/search`
  - returns paginated `approved` bookmarks matching query/tags

## Sequence: Submit Bookmark

```mermaid
sequenceDiagram
    participant Browser as "Browser"
    participant API as "POST /api/bookmarks"
    participant Site as "Target Site"
    participant Shot as "Browserless"
    participant Img as "Cloudinary"
    participant DB as "Turso"

    Browser->>API: Submit { url, tags, optional submitter }
    API->>API: Validate request (Zod), normalize URL, dedupe check
    API->>Site: Fetch HTML for metadata
    Site-->>API: HTML response
    API->>API: Extract title/description/og:image

    alt OG image exists
        API->>DB: Insert bookmark (status=pending, imageSource=og)
    else No OG image
        API->>Shot: Capture screenshot (png/jpeg)
        Shot-->>API: Image bytes or error
        alt Screenshot success
            API->>Img: Upload screenshot
            Img-->>API: Hosted image URL
            API->>DB: Insert bookmark (status=pending, imageSource=screenshot)
        else Screenshot failed
            API->>DB: Insert bookmark (status=pending, imageSource=fallback)
        end
    end

    API-->>Browser: 201 Created + bookmarkId
```

## Sequence: Browse and Search

```mermaid
sequenceDiagram
    participant Browser as "Browser"
    participant API as "GET Endpoints"
    participant DB as "Turso"

    Browser->>API: GET /api/bookmarks?limit&offset
    API->>DB: Query approved bookmarks + tags
    DB-->>API: Rows
    API-->>Browser: Paginated results

    Browser->>API: GET /api/bookmarks/search?q&tags&limit&offset
    API->>DB: Query approved bookmarks filtered by title/tag
    DB-->>API: Rows
    API-->>Browser: Paginated filtered results
```

## Sequence: Moderation (Planned)

```mermaid
sequenceDiagram
    participant Admin as "Admin UI"
    participant AdminAPI as "Admin Function (planned)"
    participant DB as "Turso"

    Admin->>AdminAPI: GET pending bookmarks
    AdminAPI->>DB: Select where status = pending
    DB-->>AdminAPI: Pending queue
    AdminAPI-->>Admin: Queue data

    Admin->>AdminAPI: PATCH bookmark status (approved/rejected)
    AdminAPI->>DB: Update status (+ approvedAt when approved)
    DB-->>AdminAPI: Updated record
    AdminAPI-->>Admin: Success response
```

## Current Gaps

- Moderation API and admin UI are not implemented yet
- Submission pipeline stores new entries as `pending`, so approval workflow is required for public visibility

## Operational Notes

- Functions expect server-side env vars (no `VITE_` prefix)
- Browserless screenshots should use supported output types (`png`/`jpeg`)
- Cloudinary stores uploaded screenshots; frontend consumes hosted URLs

## Source Pointers

- Frontend routes: `src/App.tsx`
- Home page flow: `src/pages/HomePage.tsx`
- Submit page flow: `src/pages/SubmitPage.tsx`
- API client: `src/api/bookmarks.ts`
- Functions:
  - `netlify/functions/process-bookmark.mts`
  - `netlify/functions/get-bookmarks.mts`
  - `netlify/functions/search-bookmarks.mts`
- Function shared libs: `netlify/functions/lib/*`
- Schema: `src/db/schema.ts`
