# NexClean end-to-end test suite

Playwright tests covering the whole app: every public API endpoint and every
page/form/component across the customer, agent, and admin apps. Organized by
project (one per app surface) so you can run just the slice you care about.

## Layout

```
tests/
├── api/                  API-only tests (Playwright's request context), one file per backend module
├── e2e/
│   ├── customer/         Browser tests for /app/*   (customer role)
│   ├── agent/             Browser tests for /agent/* (cleaner role)
│   └── admin/             Browser tests for /admin/* (admin role)
├── fixtures/
│   ├── api-client.ts      Shared login/auth helpers (DEMO_OTP, loginAsAdmin, authHeader, ...)
│   ├── ui-helpers.ts       Shared UI login helpers (loginCustomerUI, loginAgentUI, loginAdminUI)
│   └── base.ts             `test`/`expect` re-export with a `request` fixture fix (see below) — a few
│                            spec files instead carry a local same-purpose helper (documented inline)
├── playwright.config.ts   Defines the 4 projects below + API_BASE_URL/WEB_BASE_URL
└── run-all.sh             Boots backend+frontend against a disposable local DB, then runs everything
```

## Running

```bash
cd tests
npm install                       # first time only

./run-all.sh                      # full suite: boots backend+frontend on a disposable
                                   # local Mongo DB (never the real backend/.env Atlas
                                   # cluster), then runs every project, then tears down
                                   # any server it started itself.

./run-all.sh --project=api        # any playwright CLI flag is forwarded, e.g. just API tests
./run-all.sh --grep=booking       # ...or just a subset by name

# If you already have `npm run dev` running in backend/ and frontend/ yourself,
# run-all.sh detects the ports are taken and reuses them as-is instead of
# starting its own — just make sure YOUR backend is pointed at a throwaway
# MONGODB_URI, not production.

npm test                          # equivalent to `playwright test`, assumes servers already up
npm run test:api                  # api project only
npm run test:e2e                  # all three e2e projects only
npm run report                    # open the last HTML report
```

**Safety**: `backend/.env` points at a production MongoDB Atlas cluster. This
suite never uses it — `run-all.sh` always overrides `MONGODB_URI` to
`mongodb://127.0.0.1:27017/nexclean-test` (a local, disposable database) when
it starts the backend itself. Never point `API_BASE_URL` at a real deployment.

## Known environment gotcha (already worked around)

Playwright's `request` fixture resolves relative URLs via `new URL(path, baseURL)`.
A path starting with `/` is treated as absolute and **discards any path segment
already in `baseURL`** — e.g. `new URL("/health", "http://localhost:4000/api")`
resolves to `.../health`, silently dropping `/api`. Since `API_BASE_URL` has a
path segment and most specs write leading-slash paths (`request.get("/health")`),
most spec files import `test`/`expect` from `../fixtures/base` (or, in the e2e
projects, a locally-scoped equivalent — see each spec's fixtures import) instead
of directly from `@playwright/test`, which wraps the `request` fixture to always
resolve against the real API origin regardless of leading slashes or which
project's `baseURL` is active. If you add a new spec file, copy an existing
sibling's import line rather than importing `@playwright/test` directly.

## Fixtures & test accounts

- `DEMO_OTP` ("123456") always verifies, regardless of what OTP was actually sent.
- Seeded demo agents (from `backend/src/config/seed.ts`, idempotent on every boot):
  `9000000001`/`9000000002`/`9000000003` are verified, `9000000004` is pending
  (lands on the agent app's KYC-gate screen — useful for testing that path).
- Seeded superadmin: `superadmin@gmail.com` / `password123` (from `backend/.env`'s
  `ADMIN_EMAIL`/`ADMIN_PASSWORD`, defaulted by `run-all.sh`).
- Most tests create a fresh customer per test (`freshPhone()` / `loginAsNewCustomer`)
  so runs don't collide with each other or with previous runs against the same DB.

## What's covered

- **API** (`tests/api/`): every module — auth, users, bookings, catalog, subscriptions,
  payments, wallet, chat, notifications, area alerts, leads, agent, and the full
  admin surface (dashboard, bookings/dispatch, agents, customers, payments,
  pricing/plans, locations, vehicle categories/brands, promotions/coupons,
  referrals, content, roles/staff) — happy paths, validation errors, and
  auth/role rejections.
- **Customer app** (`tests/e2e/customer/`): login/signup, profile + phone change,
  vehicles, addresses, the full 5-step booking flow, subscriptions + wash
  scheduling, bookings list + cancel, wallet, refer & earn, notifications, help/chat.
- **Agent app** (`tests/e2e/agent/`): login/signup + KYC gate, dashboard + online
  toggle, jobs list + job detail status flow + before/after photo gating, area
  alert, profile, help/chat.
- **Admin app** (`tests/e2e/admin/`): login, dashboard, bookings + dispatch queue,
  agents + verification + detail, customers, payments, pricing, plans, locations,
  vehicle categories/brands, promotions, special coupons, referrals, content,
  area alerts, push campaigns, leads, reports, roles & staff, live chat support.

## If a test fails

Don't assume it's the test — several genuine app bugs were found and fixed this
way (see `git log` on `backend/src/shared/middleware/auth.ts`,
`frontend/src/modules/customer/pages/{Login,Signup}.tsx`, and
`frontend/src/modules/admin/components/BarChart.tsx`). Check `npm run report`
for the trace/screenshot before changing an assertion.
