# Contributing to MakerBench

Start from an issue, work on a `codex/<issue>-<topic>` branch, and keep each
stack layer focused on one review question. Run `pnpm stack:check` before and
after any `gh stack` init, rebase, or sync. It requires recorded Git conflict
resolution to remain disabled; resolve conflicts manually and inspect the
result before continuing.

Install with `pnpm install --frozen-lockfile`. Lefthook installs from `prepare`:
pre-commit checks staged formatting, relevant linters, diff whitespace, and
unmerged index entries without writing files. Pre-push runs `pnpm check:fast`.
The complete required gate is `pnpm check:pr`; do not bypass it merely because a
local hook passed.

Before requesting review, include the linked issue, primary review question,
stack position, validation evidence, and migration/deployment ordering in the
PR description. Do not change branch protections, rulesets, or remote settings
from a feature branch.

See [quality gates](docs/quality-gates.md) and the
[release checklist](docs/release-checklist.md).
