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

## Production with PM2 (four workers)

Use Node.js 22 or newer and install PM2 on your VPS with `npm install -g pm2`.
From the repository's `backend` directory:

```bash
npm ci
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 status
```

The ecosystem file launches four `nexclean-api` workers in PM2 cluster mode.
They share the port from `backend/.env` (`4000` by default), so nginx continues
proxying to one port. The working directory is pinned to `backend`, where the
application loads `.env`. Production credentials must be configured there.

The ecosystem file sets `SOCKET_ADAPTER=mongo`. Socket.IO uses your existing
`MONGODB_URI` Atlas connection to relay job offers, reschedule prompts, chat,
notifications, tracking, and cache invalidation between all four workers.
Redis is not required; `REDIS_URL` can stay empty. Only worker `0` runs the
dispatch/scheduling loop.

The Atlas database user needs read/write access to the application database,
including index creation and change streams on `socket_io_events`. Event records
have a 60-second TTL index; MongoDB removes expired records asynchronously.
Adapter initialization fails visibly if the connection or change-stream permissions
are unavailable, rather than reporting that cross-worker delivery is ready.

For a normal local standalone MongoDB, use `SOCKET_ADAPTER=auto` (the default)
or `local` when running `npm run dev`. The MongoDB adapter requires a replica
set or sharded cluster, as provided by Atlas. `auto` selects Redis if `REDIS_URL`
is set, otherwise local sockets. The PM2 ecosystem explicitly selects MongoDB.
After updating the code, run `npm ci`, `npm run build`, then
`pm2 startOrReload ecosystem.config.js --only nexclean-api --update-env` and
`pm2 save`. Confirm the worker logs contain `Socket.IO using MongoDB adapter`.

If `nexclean-api` already exists as a single fork-mode process, replace that
old process once before starting the ecosystem file:

```bash
pm2 delete nexclean-api
pm2 start ecosystem.config.js
pm2 save
```

For later updates, rebuild and reload the configured workers:

```bash
npm run build
pm2 reload ecosystem.config.js --update-env
pm2 save
```

To restore the saved workers after a server reboot, run `pm2 startup` and execute
the setup command it prints, then run `pm2 save`.

Run PM2 commands and `deploy.sh` as the same Unix user that owns the application.
For example, `pm2 status` as `nexclean` uses `/home/nexclean/.pm2` by default;
`sudo pm2 status` uses a different PM2 process list. Do not start another copy
before checking which user owns any API already listening on the application port.
The deploy script prints its user and PM2 directory to make this visible.

`deploy.sh` uses the ecosystem file to start a missing application or reload an
existing one, verifies four workers are online in cluster mode, and saves the
process list. It does not delete PM2 applications. An existing fork-mode process
still needs the one-time migration described above.

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
