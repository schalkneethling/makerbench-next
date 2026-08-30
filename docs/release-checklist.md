# Release checklist

- [ ] Main is clean from a fresh `pnpm install --frozen-lockfile` clone.
- [ ] `pnpm check:pr` and all repository-owned GitHub checks pass.
- [ ] Every issue and stack layer has a resolved review finding or recorded
      inapplicability.
- [ ] No critical or high dependency alert remains open.
- [ ] Production smoke, accessibility, cache, RLS, and performance evidence are
      current and sanitized.
- [ ] Migrations were applied before dependent code and production verification.
- [ ] Documentation matches deployed behavior and no release-blocker issue or
      PR remains open.
