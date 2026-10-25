# Local baseline verification ? 2026-10-25

Refs #51. Base revision: `bbef51d`. Windows, Node 24.15.0, npm 11.12.1,
PostgreSQL 16 in a new Docker container bound only to 127.0.0.1:55432.
Existing backend .env and existing databases were not changed.

- Patched Vite 8.3.5, Zod 4.6.7 and compatible transitive advisories.
  Both npm audits: zero vulnerabilities at verification time.
- Backend and frontend builds PASS; four migrations and explicit development seed PASS.
- Real PostgreSQL API integration: 16 subtests PASS (17 including parent).
- Playwright: 54/54 PASS on desktop/mobile, including delayed authentication,
  owner refresh, logout and foreign/legacy confirmation rejection.
- Removed Vite-generated API fallback responses. Backend failure now remains an
  HTTP error; UI fixtures remain explicit Playwright mocks.
- Confirmation storage is owner-bound, cleared across auth transitions and optional:
  storage errors cannot turn an already-created order into a checkout failure.

Commands: canonical install/build/migration/seed and test commands in website/README.md.
Local verification environment is held in ignored `.local/security-env.json`;
no credentials are included here. AWS was not contacted. Full real browser checkout,
new security labs, hosted CI on these changes and human review are tracked separately.
