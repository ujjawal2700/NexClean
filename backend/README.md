# NexClean API (backend)

Node + Express + TypeScript + MongoDB (Mongoose), organized by role-based modules
that mirror the frontend. JWT auth via phone OTP.

## Run
```bash
cd backend
cp .env.example .env      # set MONGODB_URI + JWT_SECRET
npm install
npm run dev               # http://localhost:4000
```
The HTTP server starts listening before connecting to Mongo, so `GET /api/health`
works even if the database is unreachable.

## Structure
```
src/
├── config/        env + Mongoose connection
├── shared/        ApiError, apiResponse, asyncHandler, jwt, otp,
│                  middleware (auth, validate, error), Express type augmentation
├── modules/
│   ├── catalog/   packages, pricing, plans (server-side source of truth)
│   ├── auth/      phone-OTP login → JWT  (Otp model)
│   ├── user/      profile, vehicles, addresses  (User model)
│   ├── booking/   create (price computed server-side), list, cancel  (Booking model)
│   └── subscription/  subscribe / cancel a plan
├── routes/        mounts all module routers under /api
├── app.ts         express app + middleware + health + error handling
└── index.ts       entry: listen, then connect DB
```

## Endpoints (all under `/api`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/health` | – | Liveness + DB status |
| GET  | `/catalog/packages` | – | Service packages |
| GET  | `/catalog/pricing` | – | Vehicle types + base prices |
| GET  | `/catalog/plans` | – | Subscription plans |
| POST | `/auth/send-otp` | – | `{ phone }` → sends OTP (logged to console) |
| POST | `/auth/verify-otp` | – | `{ phone, code }` → `{ token, user }` |
| GET  | `/auth/me` | ✓ | Current user |
| PATCH| `/users/me` | ✓ | Update name |
| POST/DELETE | `/users/me/vehicles[/:id]` | ✓ | Manage garage |
| POST/DELETE | `/users/me/addresses[/:id]` | ✓ | Manage addresses |
| GET  | `/bookings` | ✓ | My bookings |
| POST | `/bookings` | ✓ | Create (price computed server-side) |
| PATCH| `/bookings/:id/cancel` | ✓ | Cancel an upcoming booking |
| POST/DELETE | `/subscriptions` | ✓ | Subscribe / cancel a plan |

OTP: codes are logged to the server console (no SMS provider yet). The
`DEMO_OTP` from `.env` (default `123456`) always works in development.

## Not yet wired (later phases)
Agent & admin modules, Smart Area Alert + FCM, Razorpay payments, Cloudinary
uploads, reviews/coupons/societies. The frontend still uses its local mocks —
connecting it to this API is the next step.
