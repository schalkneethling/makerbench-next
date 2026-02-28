# Phase 1: Foundation & Core Backend

## Overview

Phase 1 establishes the backend infrastructure needed to accept, process, and retrieve bookmark submissions. This phase focuses on the API layer—no frontend work included.

**Goal:** A working API that can receive bookmark submissions, extract metadata, store data, and serve bookmarks to a future frontend.

**Estimated Duration:** 1-2 weeks
**Dependencies:** None (foundational phase)

---

## User Stories

### US-1: Submit a Bookmark

**As a** user
**I want to** submit a URL with descriptive tags
**So that** I can save a tool for later discovery

#### Acceptance Criteria

1. System accepts a URL and one or more tags
2. System validates the URL format before processing
3. System rejects duplicate URLs with clear error message
4. System extracts page metadata automatically:
   - Page title
   - Meta description
   - Open Graph image (if available)
5. If no OG image exists, system captures a screenshot of the page
6. If screenshot fails, system uses a fallback placeholder image
7. Bookmark is created with "pending" status (not publicly visible)
8. System returns confirmation with bookmark ID
9. System returns clear error messages for validation failures

#### Edge Cases

- URL returns 404 or is unreachable → Accept submission, use fallback image, title defaults to URL
- URL requires authentication → Screenshot may fail, use fallback
- URL is very slow to load → Timeout after reasonable period, use fallback
- Malformed tags (empty strings, special chars) → Reject with validation error

---

### US-2: Browse Approved Bookmarks

**As a** visitor
**I want to** see a list of approved bookmarks
**So that** I can discover useful tools

#### Acceptance Criteria

1. Only bookmarks with "approved" status are returned
2. Results are ordered by newest first (creation date)
3. Each bookmark includes:
   - Title
   - Description
   - Image URL (OG, screenshot, or fallback)
   - Associated tags
   - Original URL
   - Creation date
4. Results are paginated (default 20, max 100 per request)
5. Response includes total count and "has more" indicator

---

### US-3: Search Bookmarks by Title

**As a** visitor
**I want to** search bookmarks by title text
**So that** I can find tools I'm looking for

#### Acceptance Criteria

1. Search performs partial text matching on title
2. Search is case-insensitive
3. Only approved bookmarks are included in results
4. Empty search returns all approved bookmarks
5. Results include same data as browse (US-2)
6. Results are paginated

---

### US-4: Filter Bookmarks by Tags

**As a** visitor
**I want to** filter bookmarks by one or more tags
**So that** I can narrow down results to relevant categories

#### Acceptance Criteria

1. System accepts one or more tag names as filter
2. Bookmarks matching ANY of the provided tags are returned (OR logic)
3. Only approved bookmarks are included
4. Tag matching is case-insensitive
5. Non-existent tags return empty results (not error)
6. Can combine with title search

---

### US-5: Combined Search

**As a** visitor
**I want to** search by title AND filter by tags simultaneously
**So that** I can find exactly what I need

#### Acceptance Criteria

1. Title search and tag filter can be used together
2. Results must match title AND have at least one matching tag
3. Pagination works correctly with combined filters

---

## Functional Requirements

### FR-1: Bookmark Submission Endpoint

| Requirement | Description                                        |
| ----------- | -------------------------------------------------- |
| **FR-1.1**  | Accept POST requests with URL and tags             |
| **FR-1.2**  | Validate URL format (must be valid HTTP/HTTPS URL) |
| **FR-1.3**  | Validate tags (at least 1, non-empty strings)      |
| **FR-1.4**  | Check for duplicate URLs in database               |
| **FR-1.5**  | Fetch and parse target page HTML                   |
| **FR-1.6**  | Extract title, description, OG image from HTML     |
| **FR-1.7**  | Capture screenshot when OG image unavailable       |
| **FR-1.8**  | Store screenshot in cloud storage                  |
| **FR-1.9**  | Create bookmark record with pending status         |
| **FR-1.10** | Create/link tag records                            |
| **FR-1.11** | Return success response with bookmark ID           |
| **FR-1.12** | Return appropriate error responses                 |

### FR-2: Bookmark Retrieval Endpoint

| Requirement | Description                                    |
| ----------- | ---------------------------------------------- |
| **FR-2.1**  | Accept GET requests with pagination params     |
| **FR-2.2**  | Return only approved bookmarks                 |
| **FR-2.3**  | Include associated tags for each bookmark      |
| **FR-2.4**  | Order by creation date descending              |
| **FR-2.5**  | Support limit (default 20, max 100) and offset |
| **FR-2.6**  | Return total count for pagination              |

### FR-3: Search Endpoint

| Requirement | Description                                             |
| ----------- | ------------------------------------------------------- |
| **FR-3.1**  | Accept search query parameter (optional)                |
| **FR-3.2**  | Accept tag filter parameter (optional, comma-separated) |
| **FR-3.3**  | Perform case-insensitive partial title matching         |
| **FR-3.4**  | Filter by tags with OR logic                            |
| **FR-3.5**  | Combine title and tag filters with AND logic            |
| **FR-3.6**  | Support pagination                                      |

---

## Non-Functional Requirements

### NFR-1: Performance

| Requirement | Target                                                |
| ----------- | ----------------------------------------------------- |
| **NFR-1.1** | API response time < 500ms for retrieval/search        |
| **NFR-1.2** | Bookmark processing (with screenshot) < 30 seconds    |
| **NFR-1.3** | Handle concurrent submissions without data corruption |

### NFR-2: Reliability

| Requirement | Description                                            |
| ----------- | ------------------------------------------------------ |
| **NFR-2.1** | Screenshot failures must not block submission          |
| **NFR-2.2** | External service failures must use fallbacks           |
| **NFR-2.3** | All errors logged with sufficient detail for debugging |

### NFR-3: Security

| Requirement | Description                                      |
| ----------- | ------------------------------------------------ |
| **NFR-3.1** | Database credentials never exposed to client     |
| **NFR-3.2** | API keys stored securely (environment variables) |
| **NFR-3.3** | Input sanitized before database operations       |

---

## API Contract

### POST /api/bookmarks

Submit a new bookmark.

**Request Body:**

```json
{
  "url": "https://example.com/tool",
  "tags": ["design", "svg", "icons"],
  "submitterName": "Jane Doe", // optional
  "submitterGithubUrl": "https://github.com/jane" // optional
}
```

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "bookmarkId": "uuid-here",
    "message": "Bookmark submitted. It will be reviewed shortly."
  }
}
```

**Validation Error (422):**

```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "url": ["Please enter a valid URL"],
    "tags": ["At least one tag is required"]
  }
}
```

**Duplicate Error (409):**

```json
{
  "success": false,
  "error": "This URL has already been submitted"
}
```

---

### GET /api/bookmarks

Retrieve approved bookmarks.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | number | 20 | Results per page (max 100) |
| offset | number | 0 | Skip N results |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "bookmarks": [
      {
        "id": "uuid",
        "url": "https://example.com",
        "title": "Example Tool",
        "description": "A great tool for...",
        "imageUrl": "https://s3.../screenshot.png",
        "createdAt": "2024-12-26T10:00:00Z",
        "tags": [
          { "id": "uuid", "name": "design" },
          { "id": "uuid", "name": "svg" }
        ]
      }
    ],
    "pagination": {
      "total": 150,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

---

### GET /api/bookmarks/search

Search and filter bookmarks.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| q | string | Search text (matches title) |
| tags | string | Comma-separated tag names |
| limit | number | Results per page (default 20, max 100) |
| offset | number | Skip N results |

**Examples:**

- `/api/bookmarks/search?q=icon` — Title contains "icon"
- `/api/bookmarks/search?tags=design,svg` — Has "design" OR "svg" tag
- `/api/bookmarks/search?q=react&tags=ui` — Title contains "react" AND has "ui" tag

**Response:** Same format as GET /api/bookmarks

---

## Data Requirements

### Bookmark Record

| Field              | Type      | Required | Notes                                      |
| ------------------ | --------- | -------- | ------------------------------------------ |
| id                 | UUID      | Yes      | Primary key                                |
| url                | String    | Yes      | Unique, validated URL                      |
| title              | String    | No       | Extracted from page or defaults to URL     |
| description        | String    | No       | Extracted from page                        |
| status             | Enum      | Yes      | pending, approved, rejected                |
| imageUrl           | String    | No       | OG image, screenshot URL, or fallback path |
| imageSource        | Enum      | No       | og, screenshot, fallback                   |
| submitterName      | String    | No       | Optional attribution                       |
| submitterGithubUrl | String    | No       | Optional attribution                       |
| createdAt          | Timestamp | Yes      | Submission time                            |
| approvedAt         | Timestamp | No       | Set when approved                          |

### Tag Record

| Field | Type   | Required | Notes                      |
| ----- | ------ | -------- | -------------------------- |
| id    | UUID   | Yes      | Primary key                |
| name  | String | Yes      | Unique, lowercase, trimmed |

### Bookmark-Tag Relationship

| Field      | Type | Required | Notes          |
| ---------- | ---- | -------- | -------------- |
| bookmarkId | UUID | Yes      | FK to bookmark |
| tagId      | UUID | Yes      | FK to tag      |

**Constraint:** bookmarkId + tagId must be unique (no duplicate associations)

---

## External Service Requirements

### Screenshot Service

- Capture viewport screenshot of provided URL
- Viewport size: 1280 x 800 pixels
- Wait for page to finish loading before capture
- Timeout: 30 seconds maximum
- Output: PNG image

### Image Storage

- Store screenshot images in cloud storage
- Images must be publicly accessible via URL
- Organize by date: `screenshots/YYYY/MM/{bookmark-id}.png`
- Set appropriate cache headers (images don't change)

### Fallback Image

- Static placeholder image for failed screenshots
- Should be branded/styled for Makerbench
- Dimensions: 1280 x 800 (same as screenshots)
- Located in public assets

---

## Validation Rules

### URL Validation

- Must be valid HTTP or HTTPS URL
- Maximum length: 2000 characters
- Must be unique in database

### Tag Validation

- Minimum: 1 tag required per submission
- Maximum: 10 tags per submission
- Each tag: 1-50 characters
- Tags are normalized: lowercase, trimmed
- No empty strings

### Optional Fields

- submitterName: Max 100 characters
- submitterGithubUrl: Must be valid GitHub URL if provided

---

## Error Handling Requirements

| Scenario                 | Expected Behavior                       |
| ------------------------ | --------------------------------------- |
| Invalid URL format       | 422 with validation details             |
| Missing required fields  | 422 with validation details             |
| Duplicate URL            | 409 with clear message                  |
| Target page unreachable  | Continue with fallback image            |
| Screenshot service error | Continue with fallback image            |
| Image storage error      | Continue with fallback image, log error |
| Database error           | 500 with generic message, log details   |

---

## Definition of Done

Phase 1 is complete when:

- [ ] Bookmark submission endpoint accepts valid requests
- [ ] Duplicate URLs are rejected appropriately
- [ ] Page metadata is extracted when possible
- [ ] Screenshots are captured when no OG image exists
- [ ] Fallback image is used when screenshot fails
- [ ] Bookmarks are stored with pending status
- [ ] Tags are created/linked correctly
- [ ] Retrieval endpoint returns approved bookmarks only
- [ ] Retrieval includes associated tags
- [ ] Pagination works correctly
- [ ] Search by title works (partial, case-insensitive)
- [ ] Filter by tags works (OR logic)
- [ ] Combined search + filter works
- [ ] All error scenarios handled gracefully
- [ ] API responses match documented contract

---

## Out of Scope (Phase 1)

The following are explicitly NOT part of Phase 1:

- Frontend UI
- Admin approval interface
- User authentication
- Rate limiting
- Analytics/metrics
- Email notifications
- Algolia integration

---

## Open Questions for Developer

1. **Timeout strategy:** What's the right timeout for page fetching and screenshot capture?
2. **Retry logic:** Should we retry failed screenshots or immediately fall back?
3. **URL normalization:** Should we normalize URLs (remove trailing slashes, query params, etc.) before duplicate check?
4. **Tag limits:** Is 10 tags per submission a reasonable limit?

---

_Document Version: 2.0_
_Last Updated: December 2024_
