# NexClean — Premium On-Demand Vehicle Care

Web platform where customers book doorstep car cleaning, certified agents fulfil the
service, and admins run operations. Signature feature: **Smart Area Alert** — nearby
customers get a push offer when a cleaner is servicing their area.

## Repository layout

```
NexClean/
├── frontend/   # React 19 + Vite + TS web app (role-based modules + shared design system)
└── backend/    # Node + Express + TS API (added in a later phase)
```

The Flutter wrap / APK is handled separately by the client.

## Frontend structure

```
frontend/src/
├── modules/        landing · customer · agent · admin   (role-based)
├── shared/         ui · components · hooks · lib · theme · motion · types   (reused everywhere)
├── routes/         central route map
└── app/            root App + providers
```

### Tech
React 19 · Vite · TypeScript · Tailwind v4 · Framer Motion · GSAP · Lenis · SplitType ·
React Router. Theme: Light Indigo Blue / Grey.

### Run the frontend
```bash
cd frontend
npm install
npm run dev
```

## Status
- **Phase 0 ✅** — foundation: design system, theme tokens, fonts, motion infra,
  reusable primitives, routing skeleton.
- **Phase 1 ✅** — story-driven landing page (12 sections): hero, emotional story,
  problem/solution, how-it-works, vehicles, Smart Area Alert, why, plans, app,
  testimonials, stats, CTA.
- **Phase 2 ✅** — polish: vendor code-splitting (no chunk >500 kB), lazy-loaded
  role modules, skip-link + landmarks, decorative SVGs aria-hidden, reduced-motion
  guards on looping animations.
- **Phase 3 ✅** — customer module (`/app`, mocked data via Zustand): phone+OTP
  login, dashboard + garage, 5-step booking flow (vehicle → package → schedule →
  address → payment → confirmation), bookings history, subscription plans, profile
  (manage vehicles & addresses). Protected routes, persisted to localStorage.
- **Phase 4 ✅** — backend API (Node + Express + TS + MongoDB/Mongoose, JWT):
  modules for catalog, auth (phone OTP), user, booking (server-side pricing),
  subscription. Verified end-to-end against MongoDB. See `backend/README.md`.
- **Phase 5 ✅** — agent (cleaner) module (`/agent`, mocked data via Zustand):
  phone-OTP login, online/offline toggle, today dashboard, job queue, job detail
  flow (status progression → before/after photo capture → complete), the
  **Smart Area Alert trigger** (notify nearby customers), earnings, profile.
- **Phase 6 ✅** — admin module (`/admin`, mocked data via Zustand): email/password
  login, sidebar console, dashboard (KPIs + revenue chart), bookings management,
  agents (verify/suspend), pricing editor, **Smart Area Alert manager** (radius /
  rules / template + live preview), push notification center, plans, reports.
- **Phase 7 ✅** — **customer module ↔ API integration**: real phone-OTP auth (JWT),
  React Query for server state, bookings with **server-computed pricing**,
  subscriptions, and profile (vehicles/addresses) all persisted in MongoDB.
  Verified with a live end-to-end browser test (login → add address → book →
  persists), 0 console errors. Agent & admin still run on local mocks.
- **Phase 8 ✅** — **Smart Area Alert + notifications engine** (backend): FCM sender
  (real with Firebase creds, safe **mock/log mode** without), device-token
  registration, society-based alert trigger, booking-confirmed pushes, and a
  customer notifications inbox + bell. Verified with a live browser e2e of the
  full loop (alert fires → customer's bell/inbox updates), 0 errors.
- **Phase 9 ✅** — **Razorpay payments** for bookings: server-side order creation
  (authoritative amount), Checkout on the client, **signature-verified** booking
  creation, and a `Payment` log. Live with test keys, **mock mode** without them.
  Verified live e2e (Pay → `/payments/order` → `/payments/verify` → booking +
  confirmation push), 0 errors.
- **Phase 10 ✅** — **agent & admin wired to the API** (no more mocks). Role-based
  JWT auth (`requireRole`), agent OTP + admin email/password login, seeded demo
  agents + admin, agent module (jobs/advance/photos/summary/notify-area),
  admin module (stats/bookings/agents/pricing/campaigns/plans), **dynamic pricing**,
  and **auto-assignment** of bookings to area agents. Per-role token resolver on
  the client. Verified with a live agent+admin browser e2e, 0 errors.
- **Phase 11** — deploy backend + point the live frontend at it (needs hosting) (next).

### Demo logins
- Customer: `/app` → any 10-digit number, code `123456`
- Agent: `/agent` → seeded numbers `9000000001`–`9000000004`, code `123456`
- Admin: `/admin` → `superadmin@gmail.com` / `password123`

Enable real integrations by setting env vars — no code changes:
`FIREBASE_SERVICE_ACCOUNT_BASE64` (push), `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` (payments).

### Running the integrated customer app (needs the backend)
```bash
cd backend && npm run dev      # API on :4000 (set MONGODB_URI)
cd frontend && npm run dev     # web on :5173
```
The frontend reads the API base from `VITE_API_URL` (default `http://localhost:4000/api`).
`/agent` and `/admin` still work standalone on mock data.

### Try the admin / agent consoles
`/admin` → login (any email, any 4+ char password). `/agent` → login (any number,
code `123456`).

### Try the agent app
Visit `/agent` → login (any 10-digit number, code `123456`). Open a job → advance
through On-the-way → Arrived → Cleaning → add before/after photos → Complete.

### Try the customer app
Visit `/app` → redirected to `/app/login`. Enter any 10-digit number, then any
6-digit code (demo: `123456`). State persists in localStorage.

### Drop in real assets later
Replace the placeholders in `ImageSlot` (emotional photo, before/after photos) and
add the hero video — search for `<ImageSlot` and the hero video slot. The official
logo can replace the typographic mark in `shared/components/brand/Logo.tsx`.
