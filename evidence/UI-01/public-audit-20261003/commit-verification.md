# Local source verification — 2026-10-03

Refs #51. Windows / PowerShell, Node 24.21.0, npm 11.6.1. Branch: `feature/51-kevilo-ux-audit`. Tested the working-tree changes included with this document, based on `9f758792aa13c7b402dd3699cd96aaf518e7bffa`; the containing commit identifies the resulting revision.

| Working directory | Command | Observed result |
| --- | --- | --- |
| `website/frontend` | `npm.cmd ci` | PASS |
| `website/frontend` | `npm.cmd run build` | PASS; main JS 322.45 kB (gzip 97.31 kB), CSS 33.22 kB (gzip 6.18 kB); lazy route chunks emitted |
| `website/frontend` | `npm.cmd audit --audit-level=high` | PASS, 0 vulnerabilities |
| `website/backend` | `npm.cmd ci` | PASS |
| `website/backend` | `npm.cmd run build` | PASS, Prisma Client 7.10.0 generation and TypeScript compilation |
| `website/backend` | `npm.cmd audit --audit-level=high` | PASS threshold; 2 moderate (`fast-uri`, `ip-address`), 0 high/critical; lockfiles unchanged |
| `website/frontend` | `npm.cmd run test:e2e -- --workers=2` | 40 passed (42.1s), desktop and mobile projects |

UI results include catalog 2 columns and populated-cart overflow checks at 320/390px, drawer focus, filter reset, stock limits, and 8 accessibility test cases containing 10 axe scans across Home/Catalog/empty Cart/Login/Register. Zero violations in those scans does not establish full WCAG conformance.

The UI suite intercepts API responses with fixtures. Backend integration was not rerun locally in this handoff; the added catalog-verification-item test requires the hosted CI's disposable PostgreSQL environment. Vite dev/preview fallback remains configured. F14 requires new end-to-end acceptance with reviewed catalog content and real API/PostgreSQL. Original public audit JSON/screenshots remain historical evidence and were not regenerated as proof of these fixes.

Remaining audit DoD includes reviewing all product images, restricting the verification-item API override if internal isolation is required, making drawer background inert, checking confirmation isolation across account changes, checking additional mobile/zoom states, and remeasuring LCP/CLS. The session-stored confirmation contains order/customer details and is not currently namespaced by account.

No migration, production deployment, issue closure, human review, PR approval or merge is asserted. Five hosted CI checks must pass on the latest revision before `READY FOR HUMAN REVIEW`.
