---
name: makerbench-public-catalog
description: Route MakerBench public catalog work across taxonomy, listings, moderation, submissions, Masonry, caching, migrations, and performance contracts. Use for those product changes, not general repository maintenance.
---

Read `architecture.md`, `ROADMAP.md`, the selected GitHub issue, and [the maintained contracts](references/contracts.md) before editing. Identify the affected public kind, API contract, validation schema, client hook, moderation/submission flow, cache behavior, and migration ordering. Keep Tools behavior compatible unless the issue explicitly changes it. Database schema must deploy before dependent code; public cache changes need invalidation and sanitized performance evidence.

Keep the issue acceptance criteria authoritative. Route details through maintained code and documents rather than copying a delivery plan into this skill.
