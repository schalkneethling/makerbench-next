# Launch Checklist

Use this checklist for a production release. Detailed setup and recovery steps
remain in [Production deployment](./production-deployment.md).

## Before deployment

- [ ] Confirm the release commit and production branch are correct.
- [ ] Review committed migrations and apply them to production before dependent
      application code.
- [ ] Confirm all variables in `.env.schema` are configured in the correct
      Netlify deploy context; keep server-only values out of the Vite bundle.
- [ ] Confirm production OAuth providers and redirect URLs.
- [ ] Confirm at least one verified account has the `admin` role.
- [ ] Run lint, CSS lint, typecheck, unit/function tests, Storybook tests,
      Playwright Chromium tests, and the production build.

```bash
pnpm lint
pnpm lint:css
pnpm typecheck
pnpm test
npx vitest --project storybook run
npx playwright test --project=chromium
pnpm build
```

## Deployment

- [ ] Merge or push the reviewed release commit to the production branch.
- [ ] Confirm Netlify builds that commit and deploys both `dist` and Functions.
- [ ] Stop and investigate if the build, migration, or environment validation
      fails.

## After deployment

- [ ] Smoke-test public tools/resources, search, `/submit`, and deep links.
- [ ] Verify anonymous and authenticated submissions enter moderation as
      `pending`.
- [ ] Verify duplicate submissions return a status-aware conflict before
      external metadata or screenshot work.
- [ ] Verify admin moderation and a temporary blocklist rule plus private audit
      event; remove test data afterward.
- [ ] Verify approved content becomes public and private libraries remain
      user-scoped.
- [ ] Review Netlify Function logs and Sentry, when configured.
- [ ] Record the deployed commit and any follow-up actions.

## Rollback decision

- [ ] Restore the previous Netlify deploy when the application release is
      unsafe.
- [ ] Treat database changes as forward-only: use a compatible application
      version or a reviewed forward migration rather than assuming deploy
      rollback reverses schema changes.
