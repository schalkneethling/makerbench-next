# Quality gates

Run `pnpm stack:check` before and after every `gh stack` init, rebase, and sync.
It rejects `main`, missing `origin`, a non-`origin` push default, unmerged
entries, or any rerere configuration other than `enabled=false`,
`autoupdate=false`, and `gh-stack.rerere-declined=true`.

`pnpm check:fast` is the local pre-push gate. `pnpm check:pr` adds coverage,
build, Size Limit, Storybook, and Chromium. GitHub runs Quality, Storybook,
Chromium E2E, Dependency Review, and Production Performance separately so every
required result is visible to branch protection. Their required contexts are
the job names GitHub reports: `quality`, `storybook`, `chromium`,
`dependency-review`, and `production`. The workflow names remain the
human-readable labels shown in the Actions UI.

All workflow actions are immutable SHA pins. Every Node workflow enables
Corepack, uses Node 24.20.0, and installs with
`pnpm install --frozen-lockfile`. Browser workflows install Chromium explicitly.

PostgreSQL actor/RLS integration is intentionally not a placeholder workflow:
it activates with issue #191's disposable database harness. Production
Performance runs five fresh desktop and five fresh mobile contexts, applies the
versioned absolute budgets, and fails closed after bounded navigation retries.
Each completed context writes a body-free sanitized HAR checkpoint. The
workflow uploads those checkpoints plus redacted status evidence with `always()`
even when production or a later scenario is unavailable.

Project-local skills are validated with the `skill-creator` `quick_validate.py`
script. Its Python environment must provide exactly PyYAML 6.0.3; use an
isolated temporary environment rather than adding Python packages to the
application runtime.
