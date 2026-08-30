---
name: makerbench-pr-gate
description: Prepare or review a MakerBench pull request by running its committed gates, checking stack safety and issue linkage. Use for PR readiness, review evidence, or stacked PR work; not for unrelated code changes.
---

Run `pnpm stack:check` before and after every `gh stack init`, `rebase`, or `sync`, and run `pnpm check:pr` before PR readiness. Inspect placement with `gh stack view --json` and the PR with `gh pr view --json number,body,headRefName,baseRefName,state`. Verify the linked issue, a `Closes #<issue>` body entry, the exact stack parent, and that the branch is not accidentally based on `main`.

Report every gate as `PASS`, `FAIL`, or `NOT RUN`, plus migration ordering and unresolved findings. `NOT RUN` fails readiness. Never enable rerere or treat a skipped or unavailable external check as passing.

Use committed scripts as the source of truth. Do not submit, push, change rulesets, or alter remote settings without explicit authorization.
