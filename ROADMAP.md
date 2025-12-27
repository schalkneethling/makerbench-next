# Makerbench Development Roadmap

## Product Vision

**The Problem:** Developers and designers constantly discover useful tools—icon libraries, converters, generators, utilities—use them once, and forget about them. When they need that exact tool again, they face the frustrating task of trying to remember what it was called or where they found it. We've all been there... more than once.

**The Solution:** Makerbench is a modern bookmarking tool specifically for makers. Users can:

1. **Save tools** with tags they're likely to remember when searching later
2. **Discover tools** others have shared through search and tag browsing
3. **Build a personal collection** (v2.0) with starred favorites in their dashboard
4. **Find similar tools** (v3.0) using AI-powered discovery

**Tagline:** _"Save once, find forever."_

---

## Roadmap Overview

This roadmap outlines the path from current state to MVP and beyond. Tasks are organized into phases with clear milestones and dependencies.

| Milestone      | Target   | Key Features                         |
| -------------- | -------- | ------------------------------------ |
| **MVP (v1.0)** | ~6 weeks | Submit, browse, search tools         |
| **v2.0**       | +4 weeks | User accounts, starring, collections |
| **v3.0**       | +3 weeks | AI-powered "Find Similar" discovery  |

**Implementation Documents:**

- [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) — ✅ Complete
- [PHASE_2_IMPLEMENTATION.md](./PHASE_2_IMPLEMENTATION.md) — 🚧 Current Phase

---

## Phase 1: Foundation & Core Backend ✅ COMPLETE

**Delivered:**

- ✅ Dependencies installed (Cheerio, @netlify/functions, Cloudinary)
- ✅ `process-bookmark.mts` — Submission with validation, metadata extraction, screenshot fallback
- ✅ `get-bookmarks.mts` — Paginated retrieval of approved bookmarks with tags
- ✅ `search-bookmarks.mts` — Title search and tag filtering
- ✅ Cloudinary integration for screenshot storage
- ✅ Sentry error tracking
- ✅ Comprehensive test coverage
- ⏳ `admin-bookmarks.mts` — Deferred to Phase 5

---

## Phase 2: Frontend Core UI (MVP Critical)

### 2.1 Create Layout & Components Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── MainLayout.tsx
│   ├── bookmarks/
│   │   ├── BookmarkCard.tsx
│   │   ├── BookmarkGrid.tsx
│   │   └── BookmarkSkeleton.tsx
│   ├── forms/
│   │   ├── SubmitBookmarkForm.tsx
│   │   └── SearchForm.tsx
│   ├── tags/
│   │   ├── TagBadge.tsx
│   │   └── TagCloud.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Alert.tsx
└── pages/
    ├── HomePage.tsx
    └── SubmitPage.tsx
```

### 2.2 Homepage

- [ ] Hero section with project tagline
- [ ] Search input (title search)
- [ ] Tag cloud/filter for popular tags
- [ ] Bookmark grid with pagination
- [ ] Empty state when no bookmarks

### 2.3 Bookmark Card Component

- [ ] Image display (OG/screenshot/fallback)
- [ ] Title with truncation
- [ ] Description preview
- [ ] Tag badges (clickable for filtering)
- [ ] External link to original URL
- [ ] Accessible markup (article, heading, links)

### 2.4 Submission Form

- [ ] URL input with validation
- [ ] Tag input (comma-separated or chips)
- [ ] Optional submitter info (name, GitHub)
- [ ] Submit button with loading state
- [ ] Success/error feedback
- [ ] Form reset after success

### 2.5 Search & Filter

- [ ] Debounced search input
- [ ] Tag filter (multi-select or click-to-filter)
- [ ] Combined search (title + tags)
- [ ] Clear filters button
- [ ] Result count display

---

## Phase 3: Styling & Polish (MVP Important)

### 3.1 Design System Foundation

- [ ] Define CSS custom properties (colors, spacing, typography)
- [ ] Create base reset/normalize styles
- [ ] Define breakpoints for responsive design
- [ ] Choose distinctive fonts (avoid generic fonts)

### 3.2 Component Styling

- [ ] Style all form inputs (focus states, validation)
- [ ] Style buttons (primary, secondary, disabled)
- [ ] Card styling with hover effects
- [ ] Tag badge styles
- [ ] Loading skeletons

### 3.3 Layout & Responsiveness

- [ ] Mobile-first approach
- [ ] Responsive grid for bookmark cards
- [ ] Collapsible search/filter on mobile
- [ ] Touch-friendly targets (min 44px)

### 3.4 Accessibility

- [ ] Skip links
- [ ] Focus management
- [ ] ARIA labels where needed
- [ ] Color contrast compliance
- [ ] Keyboard navigation
- [ ] Screen reader testing

---

## Phase 4: Integration & External Services

### 4.1 Browserless Integration

- [ ] Set up Browserless account
- [ ] Implement screenshot capture
- [ ] Handle viewport configuration
- [ ] Implement retry logic
- [ ] Handle rate limits

### 4.2 AWS S3 Integration

- [ ] Create S3 bucket
- [ ] Configure bucket policy (public read)
- [ ] Implement upload function
- [ ] Generate consistent file naming
- [ ] Handle upload errors

### 4.3 Fallback Image

- [ ] Create/source default placeholder image
- [ ] Add to public/ directory
- [ ] Reference in screenshot failure path

### 4.4 Algolia Integration (optional for MVP)

- [ ] Set up Algolia account
- [ ] Create search index
- [ ] Sync approved bookmarks to index
- [ ] Implement frontend search widget
- [ ] Handle index updates on approval

---

## Phase 5: Admin Panel (Post-MVP)

### 5.1 Authentication

- [ ] Decide auth strategy (Netlify Identity, simple token, etc.)
- [ ] Protect admin routes
- [ ] Implement login flow

### 5.2 Admin UI

- [ ] Pending bookmarks queue
- [ ] Approve/reject actions
- [ ] Bulk operations
- [ ] Submission details view
- [ ] Edit bookmark metadata

### 5.3 Analytics Dashboard (nice-to-have)

- [ ] Total bookmarks count
- [ ] Pending vs approved ratio
- [ ] Popular tags
- [ ] Recent submissions

---

## Phase 6: User Accounts & Personal Dashboard (Post-MVP)

This phase transforms Makerbench from a public directory into a personalized tool management platform.

### 6.1 Authentication System

- [ ] Implement authentication (options: Netlify Identity, Auth0, Clerk)
- [ ] User registration flow (email/password or OAuth)
- [ ] Email verification
- [ ] Password reset functionality
- [ ] Session management with secure cookies/tokens

### 6.2 Database Schema Updates

- [ ] Create `users` table (id, email, name, avatarUrl, createdAt)
- [ ] Create `user_bookmarks` table (userId, bookmarkId, createdAt) - for starring
- [ ] Create `user_collections` table (userId, name, description, isPublic)
- [ ] Create `collection_bookmarks` table (collectionId, bookmarkId)
- [ ] Add optional `submittedBy` FK to bookmarks table

### 6.3 User Dashboard

- [ ] Personal dashboard view with starred tools
- [ ] "My Submissions" section showing user's contributed tools
- [ ] Quick-add starred tools with one click
- [ ] Remove from starred tools
- [ ] Recently viewed tools history
- [ ] User profile settings (name, avatar, preferences)

### 6.4 Collections Feature

- [ ] Create custom collections (e.g., "React Libraries", "Design Tools")
- [ ] Add/remove tools from collections
- [ ] Public vs private collections toggle
- [ ] Share collection links
- [ ] Collection cover image from first tool

---

## Phase 7: AI-Powered Similar Tools Discovery

Enable users to discover tools similar to ones they already like using LLM-powered search.

### 7.1 "Find Similar" Feature

- [ ] Add "Find Similar" button to each tool card
- [ ] Create `/api/find-similar` Netlify Function
- [ ] Integrate with LLM provider (OpenAI, Anthropic, or similar)
- [ ] Design prompt template for tool discovery:
  ```
  Given this tool: [title], [description], [tags]
  Find similar tools that developers/designers might find useful.
  Focus on: [relevant categories]
  ```
- [ ] Parse and validate LLM responses
- [ ] Display results in modal or dedicated page

### 7.2 LLM Integration Options

- [ ] **Option A:** OpenAI GPT-4 with web browsing
- [ ] **Option B:** Perplexity API for search-augmented responses
- [ ] **Option C:** Anthropic Claude with tool use
- [ ] Implement fallback between providers
- [ ] Rate limiting to control costs
- [ ] Cache similar results for popular tools

### 7.3 Similar Tools UI

- [ ] Modal overlay with loading state
- [ ] Display found tools with:
  - Name and brief description
  - External link to tool
  - "Add to Makerbench" quick action (creates pending submission)
  - Confidence/relevance indicator
- [ ] Save search history for users
- [ ] Feedback mechanism ("Was this helpful?")

### 7.4 Cost & Rate Limiting

- [ ] Implement per-user daily/weekly limits
- [ ] Cache responses for identical tool queries
- [ ] Consider freemium model (X free searches/month)
- [ ] Admin dashboard for usage monitoring

---

## Phase 8: Enhancements & Growth (Post-MVP)

### 8.1 Discovery Features

- [ ] Bookmark categories/collections (curated by admins)
- [ ] "New This Week" section
- [ ] Trending tools (based on views/stars)
- [ ] "Random Tool" discovery button
- [ ] Related tools sidebar on tool detail page

### 8.2 Community Features

- [ ] Tool upvoting/popularity ranking
- [ ] Simple comments or reviews
- [ ] Weekly digest email of top tools
- [ ] RSS feed of new bookmarks
- [ ] Social sharing buttons

### 8.3 Developer Features

- [ ] Public API for querying bookmarks
- [ ] Browser extension for quick submissions
- [ ] Bookmarklet for one-click add
- [ ] GitHub integration (auto-import repos with topics)
- [ ] Embed widget for external sites

### 8.4 Performance

- [ ] Image optimization (lazy loading, srcset)
- [ ] Infinite scroll or load more
- [ ] Service worker for offline support
- [ ] API response caching with stale-while-revalidate

### 8.5 SEO

- [ ] Meta tags optimization
- [ ] Open Graph tags for tool sharing
- [ ] Sitemap generation
- [ ] Structured data (JSON-LD for SoftwareApplication)

---

## MVP Milestone Checklist

### Must Have (v1.0)

- [ ] Homepage displays approved bookmarks
- [ ] Users can submit new URLs with tags
- [ ] Submitted URLs go to pending status
- [ ] Metadata (title, description, image) extracted automatically
- [ ] Search by title works
- [ ] Filter by tag works
- [ ] Mobile responsive
- [ ] Accessible

### Should Have (v1.0)

- [ ] Screenshot fallback when no OG image
- [ ] S3 storage for screenshots
- [ ] Basic admin approval UI
- [ ] Loading states
- [ ] Error handling UI

### Nice to Have (v1.0)

- [ ] Algolia-powered search
- [ ] Popular tags cloud
- [ ] Pagination
- [ ] Animation/transitions

---

## v2.0 Milestone (User Accounts)

### Must Have

- [ ] User registration and login
- [ ] Personal dashboard with starred tools
- [ ] Star/unstar tools functionality
- [ ] View submission history

### Should Have

- [ ] Custom collections
- [ ] Public/private collection toggle
- [ ] User profile settings

---

## v3.0 Milestone (AI Discovery)

### Must Have

- [ ] "Find Similar" button on tool cards
- [ ] LLM integration for discovery
- [ ] Display similar tools results

### Should Have

- [ ] Quick-add discovered tools
- [ ] Usage rate limiting
- [ ] Response caching

---

## Estimated Timeline

| Phase                   | Duration      | Dependencies |
| ----------------------- | ------------- | ------------ |
| Phase 1 (Backend)       | 1-2 weeks     | None         |
| Phase 2 (Frontend UI)   | 2-3 weeks     | Phase 1      |
| Phase 3 (Styling)       | 1-2 weeks     | Phase 2      |
| Phase 4 (Integrations)  | 1 week        | Phase 1      |
| **MVP v1.0 Complete**   | **5-8 weeks** | -            |
| Phase 5 (Admin)         | 2 weeks       | MVP          |
| Phase 6 (User Accounts) | 3-4 weeks     | Phase 5      |
| Phase 7 (AI Discovery)  | 2-3 weeks     | Phase 6      |
| Phase 8 (Enhancements)  | Ongoing       | MVP          |

---

## Suggested Improvements to Current Code

### Database

1. **Add unique constraint** to bookmark_tags (bookmarkId + tagId) to prevent duplicates
2. **Add `imageUrl` column** to bookmarks table for cleaner queries
3. **Consider** adding `submitterName` and `submitterGithubUrl` columns

### Validation

1. **Add max URL length** validation (browsers support ~2000 chars)
2. **Normalize URLs** before storing (remove trailing slashes, etc.)
3. **Validate tag count** (max 10 tags per submission?)

### Queries

1. **Add transaction support** for creating bookmark + tags atomically
2. **Add function** to create bookmark with tags in one operation
3. **Add count queries** for pagination totals

### Code Organization

1. **Create `src/api/`** directory for API client functions
2. **Create `src/hooks/`** for React hooks (useBookmarks, useSearch, etc.)
3. **Create `src/types/`** for shared TypeScript interfaces

---

## Feature Suggestions

### Core Value Proposition

> "Save once, find forever" - Tools tagged with keywords YOU remember.

### AI-Powered Discovery (v3.0 Priority)

1. **Find Similar** - LLM-powered discovery of related tools
2. **Smart Tagging** - AI suggests tags based on tool content
3. **Natural Language Search** - "Find me a tool to convert SVG to React"
4. **Tool Recommendations** - Based on user's starred tools

### User Experience (v2.0 Priority)

1. **Personal Dashboard** - Starred tools at a glance
2. **Collections** - Organize tools into themed lists
3. **Submission Credit** - Show who contributed each tool
4. **Recently Viewed** - Quick access to tools you checked out

### Community Features

1. **Upvoting** - Let users upvote useful bookmarks
2. **Comments** - Simple comments on bookmarks
3. **Weekly Digest** - Email newsletter of top bookmarks
4. **Leaderboard** - Top contributors

### Discovery Features

1. **Related Bookmarks** - "You might also like" based on tags
2. **Random Bookmark** - "I'm feeling lucky" button
3. **New This Week** - Highlight recent additions
4. **Trending Tags** - Show rising tag popularity

### Developer Features

1. **API Access** - Public API for querying bookmarks
2. **Bookmarklet** - Quick submit from any page
3. **Browser Extension** - Submit current page
4. **GitHub Integration** - Auto-import repos with specific topics

---

## Risks & Mitigations

| Risk                     | Impact | Mitigation                                              |
| ------------------------ | ------ | ------------------------------------------------------- |
| Browserless rate limits  | High   | Implement queuing, batch processing                     |
| S3 costs for images      | Medium | Image compression, lifecycle rules                      |
| Spam submissions         | High   | Rate limiting, CAPTCHA, approval queue                  |
| Turso free tier limits   | Medium | Monitor usage, plan upgrade path                        |
| OG extraction failures   | Medium | Robust error handling, fallbacks                        |
| **LLM API costs**        | High   | Aggressive caching, rate limits per user, usage caps    |
| **LLM response quality** | Medium | Prompt engineering, human review for featured results   |
| **Auth security**        | High   | Use established provider (Clerk/Auth0), security audits |
| **User data privacy**    | High   | GDPR compliance, clear privacy policy, data export      |
| **Feature creep**        | Medium | Strict MVP focus, phase gates before proceeding         |

---

## Next Immediate Steps

**Developer: Start with [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md)**

1. ✅ Review Phase 1 implementation document
2. **Install missing dependencies** (Cheerio, AWS SDK, @netlify/functions)
3. **Create `/netlify/functions/` directory structure**
4. **Fix environment variable strategy** (use `Netlify.env.get()`)
5. **Implement `process-bookmark.mts`** function
6. **Test end-to-end bookmark submission flow**

---

## Document History

| Version | Date     | Changes                                                                   |
| ------- | -------- | ------------------------------------------------------------------------- |
| 1.2     | Dec 2024 | Phase 1 complete, added Phase 2 implementation doc                        |
| 1.1     | Dec 2024 | Added Phase 6 (User Accounts), Phase 7 (AI Discovery), updated milestones |
| 1.0     | Dec 2024 | Initial roadmap                                                           |

_Last updated: December 2024_
