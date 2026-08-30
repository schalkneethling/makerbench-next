# Production performance evidence

MakerBench captures reproducible, non-mutating browser scenarios against:

```text
https://makerbench.schalkneethling.com
```

The harness uses five fresh desktop contexts and five fresh mobile contexts by
default. Each context measures:

1. Cold Tool homepage load.
2. Warm Tool homepage reload.
3. Tool text search with `css`.
4. Tool tag selection when production exposes tags.
5. SPA navigation to Resources.
6. Resource text search with `design`.
7. Resource sort change.
8. SPA navigation to Submit.
9. Switching between Tool and Resource without submitting.

No scenario signs in, submits data, or changes server state.

## Setup

Install dependencies and the Playwright Chromium browser:

```bash
pnpm install
npx playwright install --with-deps chromium
```

The capture command detects a missing Chromium executable and reports this
setup command.

## Captures

Create a timestamped, gitignored capture:

```bash
pnpm performance:capture
```

For a short diagnostic capture, pass a bounded run override:

```bash
pnpm performance:capture -- --runs=1
```

The initial committed evidence was created once with:

```bash
pnpm performance:baseline
```

Baseline files are exclusively created and never overwritten. A later,
intentional baseline needs a different date supplied directly to the capture
script and an evidence-backed issue:

```bash
node scripts/performance/capture.ts --baseline=YYYY-MM-DD
```

Production navigation uses three bounded attempts. Continued production
unavailability fails the capture instead of silently producing partial
evidence. Non-success API responses are logged and retained in the HAR so a
baseline cannot erase pre-existing behavior; capture continues only when the
UI scenario can still complete.

GitHub uses a deterministic artifact directory and the full five-run contract:

```bash
pnpm performance:capture -- --runs=5 --artifact=ci
pnpm performance:production-budget -- \
  --summary=performance/artifacts/ci/summary.json \
  --evidence=performance/artifacts/ci/budget-result.json
```

The production workflow has no production credentials. It fails when any
required scenario has fewer than five runs, a required metric is missing, a
budget is exceeded, or production remains unavailable after the bounded retry
policy.

## Evidence contract

The baseline directory contains:

```text
performance/baselines/YYYY-MM-DD/
  pre-taxonomy-desktop.har.zip
  pre-taxonomy-mobile.har.zip
  summary.json
  summary.md
```

The browser collector records navigation, resource, paint, LCP, layout shift,
Event Timing, long-task, Long Animation Frame, mark, measure, cache, and
Server-Timing data when supported. Unsupported optional APIs remain visible as
missing samples in the summary.

Raw Playwright HARs use `content: "omit"`. Before an artifact is written, a
strict Valibot sanitizer:

- removes response bodies, request bodies, cookies, pages, comments, and
  non-allowlisted fields;
- retains bounded timing, request URL/method, status, MIME type, transfer size,
  cache headers, `Cache-Status`, and `Server-Timing`;
- removes credentials, fragments, and sensitive query parameters from URLs;
- retains only explicitly allowlisted request and response headers;
- validates the sanitized result independently; and
- writes with exclusive creation so existing evidence cannot be replaced.

Subsequent captures are stored under `performance/artifacts/` and are ignored
by Git.

Every capture creates `capture.json` before Chromium launches. Each completed
browser context is immediately sanitized and written under `checkpoints/`; raw
HARs remain only in a temporary directory. Successful captures add the merged
device HARs, summaries, and `success.json`. Failed captures retain completed
sanitized checkpoints and add `failure.json` containing only a fixed-vocabulary
category and location—browser error messages are never copied into artifacts.
GitHub uploads the whole deterministic capture directory even after a failed
capture or budget check.

## Interpretation

`summary.json` is the machine-readable source. `summary.md` is a generated
review view. Percentiles use the deterministic nearest-rank method, and
missing-run counts must be considered before comparing a metric. Transfer
sizes come from browser Resource Timing; cross-origin resources without
appropriate timing exposure can report zero and remain visible in the
sanitized HAR.

Runtime budgets live in `performance/budgets.json`. They use absolute p75
ceilings derived from the initial production measurements and require the eight
non-optional scenarios for both desktop and mobile. The Tool tag-selection
scenario remains evidence when tags are available, but is not a required budget
input because the production catalog may legitimately expose no tags.

The initial baseline records the known production Tool tag-filter HTTP 500
tracked by [issue #206](https://github.com/schalkneethling/makerbench-next/issues/206).
