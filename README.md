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
- **Phase 5** — connect the frontend to the API (replace mocks), then agent/admin
  modules, FCM, payments (next).

### Try the customer app
Visit `/app` → redirected to `/app/login`. Enter any 10-digit number, then any
6-digit code (demo: `123456`). State persists in localStorage.

### Drop in real assets later
Replace the placeholders in `ImageSlot` (emotional photo, before/after photos) and
add the hero video — search for `<ImageSlot` and the hero video slot. The official
logo can replace the typographic mark in `shared/components/brand/Logo.tsx`.
