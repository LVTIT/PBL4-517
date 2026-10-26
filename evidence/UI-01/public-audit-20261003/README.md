# Public UI/UX audit — 2026-10-03

Related to #51. Target: <https://47.129.214.70/>. Requested scope: test website and propose improvements.

Canonical findings and implementation proposal: [audit report](../../../docs/ui/kevilo-public-audit-20261003.md). Recommendations are **Proposed**, with F13/F14 **Planned** following explicit user requests; application/production fixes were not made in this audit.

Later source handoff on the same date: [local build/test verification](commit-verification.md). The original captures below describe the pre-change public website. They do not prove the new source was deployed or all findings were resolved. F14 real-data acceptance remains pending.

**Follow-up requirement:** F14 requires verified catalog content and real API/PostgreSQL end-to-end acceptance, replacing mocked auth/order evidence with new verified runs. Mocked observations below remain accurately labeled historical evidence; this plan update did not execute those replacement runs.

## Environment and evidence identity

- Windows, Node 24.21.0, Playwright with headless Chromium 153.0.8010.12.
- Checkout source read at `9f758792aa13c7b402dd3699cd96aaf518e7bffa`; PR #52 was OPEN with that head SHA when inspected using GitHub's public API.
- Normal TLS validation. No ignored certificate errors.
- Served JS `/assets/index-LQ7uQqz9.js` SHA256 `6d4b43e104a492477b86a899f2c182b651e9207240514ef564d999c30446b30e`.
- Served CSS `/assets/index-oAVxOHgT.css` SHA256 `179181af9b83e4cb5a1a8f1c6a96b3d48938ee915975aa58ede959c97ba7003c`.
- JS/CSS byte comparison matched the existing local build. All 10 public product images matched checkout assets byte for byte. Backend deployment SHA was not checked.

## Files

| File | Meaning |
| --- | --- |
| `baseline.json` | 14 live page/viewport states, axe violations/incomplete, normal-load console/network observations and initial navigation/resource timings |
| `interactions.json` | Filtering/sorting/URL reload, stock-limit feedback, drawer focus sequence, form errors and locally simulated API outages/retry |
| `extended.json` | Three throttled cold-load samples; response headers/image hashes; explicitly mocked auth header and order success |
| `supplemental.json` | Asset compression/cache headers/hash comparisons, settled navigation state, exact cart client/scroll widths and image/name mapping |
| `final-checks.json` | Pending search debounce restoring the filter after Reset |
| `baseline.mjs`, `interactions.mjs`, `extended.mjs`, `supplemental.mjs`, `final-checks.mjs` | Ad hoc read/UI audit scripts, separate from application CI suite; use existing frontend devDependencies |

Selected PNGs show the real storefront, cart overflow and product image mismatches. `register-error-390.png` shows a client-only validation failure. `guest-success-simulated-390.png` uses a mocked response and is **not** evidence that the server created an order.

## Reproduction

Scripts resolve dependencies using the absolute path of this checkout; adjust `createRequire` and local asset paths when cloning elsewhere. With frontend devDependencies and Playwright Chromium already installed, run from PowerShell with a private temporary output folder:

```powershell
$taskOutput = Join-Path $env:TEMP 'kevilo-audit-retest'
New-Item -ItemType Directory -Force -Path $taskOutput | Out-Null
node evidence/UI-01/public-audit-20261003/baseline.mjs $taskOutput
node evidence/UI-01/public-audit-20261003/interactions.mjs $taskOutput
node evidence/UI-01/public-audit-20261003/extended.mjs $taskOutput
node evidence/UI-01/public-audit-20261003/supplemental.mjs $taskOutput
node evidence/UI-01/public-audit-20261003/final-checks.mjs $taskOutput
```

These scripts record observations, including failures; they do not certify all checks pass and are not a replacement for the project's e2e/integration suites. Asset filenames and expected catalog content describe this audited revision and may require adjustment after a new build.

## Results and limitations

- PASS: normal HTTPS access/health, real catalog reads, category/sort/URL reload, guest cart persistence, negative login, client password mismatch, catalog network recovery, Escape restoration and loaded images after scrolling.
- FAIL/defects: image/content mismatches; internal deployment item visible publicly; cart 399px width at 320/390; 36px cart controls/38px small CTA/filter; drawer focus escaping; success toast at stock cap; Reset defeated by pending debounce; tabs semantics without keyboard pattern; missing field-linked form error handling.
- Axe: 14 scans with **0 violations**, with **incomplete** results requiring manual inspection. This does not establish full WCAG conformance.
- Throttling: new context/cold cache per sample, mobile 390×844, 200,000 bytes/s download, 93,750 bytes/s upload, configured latency 150ms, CPU slowdown 4×. LCP 3392/3396/3384ms; median 3392ms. These are lab observations, not field p75 or Lighthouse scores.
- `interactions.json` contains a navigation observation taken during transition. Use the settled observation in `supplemental.json`: detail loads at scrollY 0. No persistent scroll-position defect is asserted.
- Full-page screenshots can include offscreen lazy skeletons before scrolling. The scrolled capture `catalog-loaded-1440.png` and image readiness observation confirm images load; wrong subject matter is a separate finding.
- CUSTOMER/ADMIN headers mocked only in-browser; their 320px state did not overflow. Backend auth/authorization was not tested by those mocks.
- Order success response mocked only in-browser; reload loses the confirmation view. No real checkout, stock decrement, order cancellation, account creation or email delivery was performed.
- Negative login is the only intentional real credential submission; synthetic `example.invalid` identity, no credential guessing or rate-limit stress. Network failures injected locally, not by stopping services.
- No cookies, tokens, real credentials, real customer PII or database dumps are included. Scripts contain explicitly synthetic form values and dummy passwords used for a nonexistent `example.invalid` identity. No application/infrastructure change, deployment, issue checklist update or merge was performed.
