# Phase 2: Frontend Core UI

## Overview

Phase 2 delivers the user-facing interface for Makerbench. Users will be able to browse approved tools, search and filter by tags, and submit new tools for review.

**Goal:** A functional, accessible, and visually distinctive frontend that connects to the Phase 1 API.

**Estimated Duration:** 2-3 weeks
**Dependencies:** Phase 1 complete (API endpoints functional)

---

## User Stories

### US-1: View Homepage

**As a** visitor
**I want to** see a welcoming homepage with available tools
**So that** I can immediately start discovering useful resources

#### Acceptance Criteria

1. Page displays the Makerbench brand/logo and tagline
2. Clear value proposition communicated above the fold
3. Grid of approved tool cards displayed below hero section
4. Tools ordered by newest first
5. Page loads within 2 seconds on average connection
6. Appropriate empty state shown when no tools exist
7. Loading state shown while fetching tools

#### Empty State Requirements

When no approved tools exist:

- Display friendly message explaining no tools yet
- Include call-to-action to submit the first tool
- Do not show error or broken state

---

### US-2: Browse Tool Cards

**As a** visitor
**I want to** see tool information at a glance
**So that** I can quickly decide which tools interest me

#### Acceptance Criteria

1. Each card displays:
   - Tool image (screenshot, OG image, or branded fallback)
   - Tool title (truncated if too long with ellipsis)
   - Brief description (2-3 lines max, truncated)
   - Associated tags (displayed as badges)
   - Visual link/action to visit the original tool
2. Cards have consistent sizing within the grid
3. Hovering on card provides subtle visual feedback
4. Clicking the card or title opens the tool URL in a new tab
5. Attribution shown if submitter name provided

#### Image Display

- Images maintain consistent aspect ratio (16:9 recommended)
- Fallback image displays when image fails to load
- Images lazy-load for performance

---

### US-3: Load More Tools

**As a** visitor
**I want to** load additional tools beyond the initial set
**So that** I can discover more tools without leaving the page

#### Acceptance Criteria

1. Initial load shows first 20 tools
2. Result count displays: "Showing X of Y tools" (e.g., "Showing 20 of 150 tools")
3. "Load more" button appears when more tools exist
4. Clicking "Load more" appends next batch to grid
5. Result count updates after loading (e.g., "Showing 40 of 150 tools")
6. Loading state shown on button while fetching
7. Button hidden when all tools are loaded (X equals Y)
8. Scroll position maintained after loading more
9. Result count persists through search/filter actions

---

### US-4: Search Tools by Title

**As a** visitor
**I want to** search for tools by name
**So that** I can find a specific tool I'm looking for

#### Acceptance Criteria

1. Search input prominently placed (hero or sticky header)
2. Placeholder text suggests what user can search
3. Search triggers after user stops typing (debounced, ~300ms)
4. Results update without full page reload
5. Search is case-insensitive (handled by API)
6. Current search term displayed/editable
7. Clear button to reset search
8. "No results" message when search yields nothing
9. Result count displayed (e.g., "Found 5 tools")

---

### US-5: Filter Tools by Tags

**As a** visitor
**I want to** filter tools by category tags
**So that** I can narrow down to relevant tools

#### Acceptance Criteria

1. Popular/available tags displayed (cloud, list, or pills)
2. Clicking a tag filters results to tools with that tag
3. Multiple tags can be selected (OR logic between tags)
4. Selected tags visually distinguished from unselected
5. Clicking selected tag removes it from filter
6. "Clear all" option when filters active
7. Filter combines with search (AND logic)
8. URL updates to reflect filters (shareable URLs)

---

### US-6: Combined Search and Filter

**As a** visitor
**I want to** search by title and filter by tags with control over how they combine
**So that** I can find exactly what I need

#### Acceptance Criteria

1. Both search and tag filter can be active simultaneously
2. User can toggle between AND/OR search logic
3. Default behavior: AND (results must match title AND have tag)
4. OR option: results match title OR have tag
5. Current logic mode clearly indicated in UI
6. Clear indication of all active filters
7. Single action to clear all filters and search

#### Search Logic Examples

| Title Search | Tags   | Mode | Results                                                |
| ------------ | ------ | ---- | ------------------------------------------------------ |
| "icon"       | design | AND  | Tools with "icon" in title that also have "design" tag |
| "icon"       | design | OR   | Tools with "icon" in title OR tools with "design" tag  |

---

### US-7: Submit a New Tool

**As a** user
**I want to** submit a tool I've discovered
**So that** others can benefit from it too

#### Acceptance Criteria

1. Clear navigation/button to access submission form
2. Form includes:
   - URL input (required)
   - Tags input (required, minimum 1)
   - Submitter name (optional)
   - Submitter GitHub URL (optional)
3. Real-time validation feedback on inputs
4. Submit button disabled until form is valid
5. Loading state during submission
6. Success message confirms submission with:
   - Acknowledgment that tool was received
   - Note that it will be reviewed before appearing
7. Error messages are clear and actionable
8. Form resets after successful submission
9. Option to submit another tool after success

#### Tag Input Behavior

- User can enter comma-separated tags OR
- Chip/pill interface where tags are added one at a time
- Tags normalized (trimmed, lowercased) before display
- Duplicate tags prevented
- Maximum 10 tags enforced with feedback

---

### US-8: Navigate Between Pages

**As a** visitor
**I want to** easily move between home and submit pages
**So that** I can access different features

#### Acceptance Criteria

1. Consistent header/navigation on all pages
2. Logo/brand links to homepage
3. "Submit Tool" action clearly visible
4. Current page indicated in navigation
5. Browser back/forward buttons work correctly
6. Deep links work (direct URL to /submit)

---

### US-9: Mobile Experience

**As a** mobile user
**I want to** use Makerbench on my phone
**So that** I can browse and submit tools anywhere

#### Acceptance Criteria

1. Layout adapts to screen width (responsive)
2. Tool cards stack in single column on small screens
3. Touch targets are minimum 44x44 pixels
4. No horizontal scrolling required
5. Search/filter accessible without excessive scrolling
6. Form inputs are mobile-friendly (appropriate keyboards)
7. Text readable without zooming

---

### US-10: Accessible Experience

**As a** user with disabilities
**I want to** use Makerbench with assistive technologies
**So that** I can access the same features as everyone

#### Acceptance Criteria

1. All interactive elements keyboard navigable
2. Logical focus order through the page
3. Skip link to main content provided
4. Form inputs have associated labels
5. Error messages announced to screen readers
6. Images have meaningful alt text
7. Color contrast meets WCAG AA (4.5:1 for text)
8. Focus states clearly visible
9. No content conveyed by color alone

---

## Functional Requirements

### FR-1: Homepage

| Requirement | Description                                    |
| ----------- | ---------------------------------------------- |
| **FR-1.1**  | Display hero section with branding and tagline |
| **FR-1.2**  | Fetch and display approved bookmarks from API  |
| **FR-1.3**  | Render tool cards in responsive grid layout    |
| **FR-1.4**  | Show loading skeleton while data fetches       |
| **FR-1.5**  | Handle empty state gracefully                  |
| **FR-1.6**  | Handle API errors with user-friendly message   |

### FR-2: Tool Card

| Requirement | Description                                 |
| ----------- | ------------------------------------------- |
| **FR-2.1**  | Display tool image with fallback handling   |
| **FR-2.2**  | Truncate long titles with ellipsis          |
| **FR-2.3**  | Truncate descriptions to 2-3 lines          |
| **FR-2.4**  | Render tag badges (clickable for filtering) |
| **FR-2.5**  | Link to external tool URL (opens new tab)   |
| **FR-2.6**  | Display submitter attribution if available  |

### FR-3: Search

| Requirement | Description                               |
| ----------- | ----------------------------------------- |
| **FR-3.1**  | Debounce search input (300ms recommended) |
| **FR-3.2**  | Call search API with query parameter      |
| **FR-3.3**  | Update results without page reload        |
| **FR-3.4**  | Display result count                      |
| **FR-3.5**  | Provide clear/reset functionality         |
| **FR-3.6**  | Show "no results" state when applicable   |

### FR-4: Tag Filtering & Search Logic

| Requirement | Description                                                   |
| ----------- | ------------------------------------------------------------- |
| **FR-4.1**  | Display available/popular tags                                |
| **FR-4.2**  | Toggle tag selection on click                                 |
| **FR-4.3**  | Visual distinction for selected vs unselected                 |
| **FR-4.4**  | Call search API with tags parameter                           |
| **FR-4.5**  | Provide AND/OR toggle for combining title + tags              |
| **FR-4.6**  | Default to AND logic                                          |
| **FR-4.7**  | Update URL query params for shareability (include logic mode) |

### FR-5: Load More

| Requirement | Description                                        |
| ----------- | -------------------------------------------------- |
| **FR-5.1**  | Initial load fetches first page (20 items)         |
| **FR-5.2**  | Display result count: "Showing X of Y tools"       |
| **FR-5.3**  | Display "Load more" button when hasMore is true    |
| **FR-5.4**  | Fetch next page and append to existing results     |
| **FR-5.5**  | Update result count after loading more             |
| **FR-5.6**  | Track and increment offset correctly               |
| **FR-5.7**  | Hide button when all items loaded                  |
| **FR-5.8**  | Reset count and results when search/filter changes |

### FR-6: Submission Form

| Requirement | Description                            |
| ----------- | -------------------------------------- |
| **FR-6.1**  | Render form with all required inputs   |
| **FR-6.2**  | Validate URL format on blur/change     |
| **FR-6.3**  | Validate tags (non-empty, max 10)      |
| **FR-6.4**  | Display inline validation errors       |
| **FR-6.5**  | Disable submit until valid             |
| **FR-6.6**  | POST to /api/bookmarks endpoint        |
| **FR-6.7**  | Display success confirmation           |
| **FR-6.8**  | Display error message on failure       |
| **FR-6.9**  | Reset form after successful submission |

### FR-7: Navigation/Routing

| Requirement | Description                                |
| ----------- | ------------------------------------------ |
| **FR-7.1**  | Client-side routing (no full page reloads) |
| **FR-7.2**  | Routes: `/` (home), `/submit` (form)       |
| **FR-7.3**  | Consistent header across pages             |
| **FR-7.4**  | 404 page for unknown routes                |
| **FR-7.5**  | Deep linking support                       |

---

## Non-Functional Requirements

### NFR-1: Performance

| Requirement | Target                                       |
| ----------- | -------------------------------------------- |
| **NFR-1.1** | First Contentful Paint < 1.5s                |
| **NFR-1.2** | Time to Interactive < 3s                     |
| **NFR-1.3** | Images lazy-loaded below fold                |
| **NFR-1.4** | Search debounce prevents excessive API calls |

### NFR-2: Accessibility

| Requirement | Standard                       |
| ----------- | ------------------------------ |
| **NFR-2.1** | WCAG 2.1 Level AA compliance   |
| **NFR-2.2** | Keyboard navigation throughout |
| **NFR-2.3** | Screen reader compatible       |
| **NFR-2.4** | Color contrast 4.5:1 minimum   |

### NFR-3: Browser Support

| Browser | Minimum Version |
| ------- | --------------- |
| Chrome  | Last 2 versions |
| Firefox | Last 2 versions |
| Safari  | Last 2 versions |
| Edge    | Last 2 versions |

### NFR-4: Responsive Design Philosophy

**Critical Principle:** Single component implementations that scale responsively. Do NOT create separate mobile and desktop versions of the same component.

| Guideline   | Description                                                                     |
| ----------- | ------------------------------------------------------------------------------- |
| **NFR-4.1** | Mobile-first CSS approach                                                       |
| **NFR-4.2** | One component per feature (not mobile + desktop variants)                       |
| **NFR-4.3** | Use CSS (media queries, container queries, flexbox, grid) for layout adaptation |
| **NFR-4.4** | Prefer CSS over JS for layout/visual changes                                    |
| **NFR-4.5** | Progressive enhancement from mobile baseline                                    |

**JS media detection is acceptable for:**

- Loading different image sizes/assets
- Conditional data fetching strategies
- Analytics/tracking
- Non-layout behavioral differences

**Avoid JS media detection for:**

- Rendering different component trees per viewport
- Duplicating UI components (e.g., `<MobileNav>` + `<DesktopNav>`)

**Rationale:**

- Simpler codebase, easier maintenance
- Better performance (no duplicate DOM)
- Consistent behavior across viewports

### NFR-5: Responsive Breakpoints

| Breakpoint | Width      | Layout        |
| ---------- | ---------- | ------------- |
| Mobile     | < 640px    | Single column |
| Tablet     | 640-1024px | 2 columns     |
| Desktop    | > 1024px   | 3-4 columns   |

---

## Design Requirements

### Brand Identity

**Tagline:** "Save once, find forever."

The design should communicate:

- **Professional** — For developers and designers
- **Trustworthy** — Curated, quality tools
- **Efficient** — Quick to find what you need
- **Modern** — Contemporary, not dated

### Typography

- Choose distinctive heading font (avoid generic Inter, Roboto, Arial)
- Body text should be highly readable
- Consistent type scale throughout

### Color Palette

- Define primary, secondary, accent colors
- Ensure sufficient contrast for accessibility
- Consider both light and dark mode (dark mode optional for MVP)

### Visual Hierarchy

- Hero section draws attention
- Search/filter prominent but not overwhelming
- Tool cards are the primary content
- Clear visual separation between sections

### Microinteractions

- Hover states on interactive elements
- Focus states for keyboard navigation
- Loading animations (skeletons preferred over spinners)
- Subtle transitions between states

---

## Component Inventory

The following components are needed (names are suggestions):

### Layout Components

| Component    | Purpose                         |
| ------------ | ------------------------------- |
| `Header`     | Logo, navigation, submit CTA    |
| `Footer`     | Links, copyright                |
| `MainLayout` | Page wrapper with header/footer |
| `Container`  | Max-width content wrapper       |

### Tool Display Components

| Component          | Purpose                    |
| ------------------ | -------------------------- |
| `ToolCard`         | Individual tool display    |
| `ToolGrid`         | Responsive grid of cards   |
| `ToolCardSkeleton` | Loading placeholder        |
| `EmptyState`       | No tools available message |

### Form Components

| Component    | Purpose                             |
| ------------ | ----------------------------------- |
| `SubmitForm` | Tool submission form                |
| `TextInput`  | Reusable text input with validation |
| `TagInput`   | Tag entry (comma or chips)          |
| `Button`     | Primary, secondary variants         |
| `Alert`      | Success/error messages              |

### Search & Filter Components

| Component       | Purpose                      |
| --------------- | ---------------------------- |
| `SearchInput`   | Debounced search field       |
| `TagCloud`      | Available tags for filtering |
| `TagBadge`      | Individual tag pill/badge    |
| `ActiveFilters` | Display/clear active filters |

### Utility Components

| Component        | Purpose                              |
| ---------------- | ------------------------------------ |
| `SkipLink`       | Accessibility skip to content        |
| `ResultCount`    | "Showing X of Y tools" display       |
| `LoadMoreButton` | Load more trigger with loading state |

---

## Page Specifications

### Homepage (`/`)

**Sections (top to bottom):**

1. **Header** — Logo, navigation, "Submit Tool" button
2. **Hero** — Tagline, brief description, search input
3. **Filters** — Tag cloud or filter bar
4. **Results Info** — Count and active filter indicators
5. **Tool Grid** — Cards with pagination
6. **Footer** — Links, credits

### Submit Page (`/submit`)

**Sections:**

1. **Header** — Same as homepage
2. **Page Title** — "Submit a Tool"
3. **Instructions** — Brief guidance on submission
4. **Form** — URL, tags, optional submitter info
5. **Submit Button** — With loading state
6. **Feedback Area** — Success/error messages
7. **Footer** — Same as homepage

### 404 Page

- Friendly message indicating page not found
- Link back to homepage
- Consistent with overall design

---

## API Integration

### Endpoints to Consume

| Endpoint                | Method | Purpose                  |
| ----------------------- | ------ | ------------------------ |
| `/api/bookmarks`        | GET    | Fetch approved bookmarks |
| `/api/bookmarks/search` | GET    | Search with query/tags   |
| `/api/bookmarks`        | POST   | Submit new bookmark      |

### Query Parameters

**GET /api/bookmarks:**

- `limit` (number): Results per page
- `offset` (number): Pagination offset

**GET /api/bookmarks/search:**

- `q` (string): Title search query
- `tags` (string): Comma-separated tag names
- `mode` (string): Search logic — `and` (default) or `or`
- `limit` (number): Results per page
- `offset` (number): Pagination offset

> **Note:** The `mode` parameter requires a backend update to `search-bookmarks.mts`. Current implementation uses AND logic. Developer should extend API to support OR logic when `mode=or`.

### Response Handling

- Parse JSON response
- Check `success` field
- Handle `data.bookmarks` array
- Use `data.pagination` for load more logic
- Display user-friendly errors from `error` field

---

## State Management

### Application State

| State          | Scope | Description                  |
| -------------- | ----- | ---------------------------- |
| `bookmarks`    | Page  | Array of fetched bookmarks   |
| `pagination`   | Page  | Current offset, hasMore flag |
| `searchQuery`  | Page  | Current search input         |
| `selectedTags` | Page  | Array of selected tag names  |
| `isLoading`    | Page  | Fetch in progress flag       |
| `error`        | Page  | Current error message        |

### Form State

| State                | Scope | Description                   |
| -------------------- | ----- | ----------------------------- |
| `url`                | Form  | URL input value               |
| `tags`               | Form  | Array of tag strings          |
| `submitterName`      | Form  | Optional name                 |
| `submitterGithubUrl` | Form  | Optional GitHub URL           |
| `errors`             | Form  | Field-level validation errors |
| `isSubmitting`       | Form  | Submission in progress        |
| `submitResult`       | Form  | Success/error after submit    |

---

## URL Structure

| Route     | Query Params      | Description                    |
| --------- | ----------------- | ------------------------------ |
| `/`       | `?q=&tags=&mode=` | Homepage with optional filters |
| `/submit` | none              | Submission form                |
| `/*`      | none              | 404 page                       |

**URL Examples:**

- `/` — Homepage, all tools
- `/?q=icon` — Search for "icon"
- `/?tags=design,svg` — Filter by design OR svg tags
- `/?q=react&tags=ui` — Search "react" AND has "ui" tag (default)
- `/?q=react&tags=ui&mode=or` — Search "react" OR has "ui" tag

---

## Error Scenarios

| Scenario                      | User Experience                                                 |
| ----------------------------- | --------------------------------------------------------------- |
| API fetch fails               | "Unable to load tools. Please try again." with retry button     |
| Search returns no results     | "No tools found matching your search." with clear filter option |
| Submission fails (validation) | Inline field errors shown                                       |
| Submission fails (server)     | Alert with error message, form preserved                        |
| Network offline               | "You appear to be offline. Check your connection."              |

---

## Definition of Done

Phase 2 is complete when:

- [ ] Homepage displays approved tools in grid layout
- [ ] Tool cards show image, title, description, tags
- [ ] Clicking card opens tool in new tab
- [ ] Search input filters tools by title
- [ ] Tag cloud/list allows filtering by tags
- [ ] Search and tag filters work together
- [ ] Pagination loads more tools correctly
- [ ] Empty states display appropriately
- [ ] Loading states display during fetches
- [ ] Submit form validates all inputs
- [ ] Successful submission shows confirmation
- [ ] Failed submission shows error message
- [ ] Navigation between pages works
- [ ] URLs reflect search/filter state
- [ ] Mobile layout is usable
- [ ] Keyboard navigation works throughout
- [ ] No accessibility errors (axe/Lighthouse)
- [ ] All text meets contrast requirements

---

## Out of Scope (Phase 2)

The following are explicitly NOT part of Phase 2:

- Admin panel / approval interface
- User authentication
- User accounts / profiles
- Starring / favoriting tools
- Tool detail pages
- Comments or ratings
- Dark mode (optional enhancement)
- Analytics integration
- Social sharing

---

## Open Questions for Developer

1. **Routing library:** React Router, or simpler approach for 2-3 pages?
2. **Tag source:** Fetch popular tags from API, or derive from returned bookmarks?
3. **Image aspect ratio:** 16:9, 4:3, or square thumbnails?
4. **Tag input style:** Comma-separated text, or chip/pill builder?

## Decisions Made

| Decision             | Choice                     | Rationale                                            |
| -------------------- | -------------------------- | ---------------------------------------------------- |
| Pagination pattern   | Load more                  | Keeps user in context, appends to existing view      |
| Result count         | "Showing X of Y"           | Users see progress through full dataset              |
| Search logic         | User-selectable AND/OR     | Flexibility for different search needs               |
| Default search logic | AND                        | More precise results by default                      |
| Responsive approach  | Single scalable components | Simpler code, better performance, easier maintenance |

---

## Reference: API Response Shapes

### GET /api/bookmarks (success)

```json
{
  "success": true,
  "data": {
    "bookmarks": [
      {
        "id": "uuid",
        "url": "https://example.com",
        "title": "Example Tool",
        "description": "A useful tool for...",
        "imageUrl": "https://res.cloudinary.com/.../screenshot.png",
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

### POST /api/bookmarks (success)

```json
{
  "success": true,
  "data": {
    "bookmarkId": "uuid",
    "message": "Bookmark submitted. It will be reviewed shortly."
  }
}
```

### POST /api/bookmarks (validation error)

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

---

_Document Version: 1.0_
_Last Updated: December 2024_
