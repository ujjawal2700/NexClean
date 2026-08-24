import type { APIRequestContext } from "@playwright/test";
import { test as base, expect } from "@playwright/test";
import { API_BASE_URL } from "../playwright.config";
import { authHeader, loginAsAgent, loginAsNewCustomer, SEED_AGENT_PHONE } from "./api-client";

/**
 * Local-only helpers for the agent-e2e spec files (tests/e2e/agent/**).
 * Kept separate from the shared fixtures/api-client.ts and fixtures/ui-helpers.ts
 * per the task brief, so other agents' shared files stay untouched.
 */

/**
 * The agent-e2e Playwright project's `baseURL` points at the Vite dev server
 * (http://localhost:5173) so `page.goto()` calls resolve nicely -- but that
 * also means the *built-in* `request` fixture would, by default, resolve
 * relative paths like "/auth/send-otp" against the frontend origin instead of
 * the backend API, which silently fails (non-JSON/empty response body).
 *
 * Naively re-pointing the fixture at `baseURL: API_BASE_URL`
 * ("http://localhost:4000/api") doesn't work either: fixtures/api-client.ts
 * (and this file) always call e.g. `request.post("/auth/send-otp", ...)` with
 * a LEADING SLASH, and WHATWG URL resolution treats a leading-slash relative
 * reference as absolute-path -- it replaces the baseURL's "/api" path
 * entirely instead of appending to it (`new URL("/x", "http://h/api")` =>
 * "http://h/x", dropping "/api"). Confirmed this is a real, pre-existing bug
 * in the shared tests/playwright.config.ts "api" project too (see final
 * report) -- every relative-path request.* call there silently drops "/api"
 * the same way. Worked around here (without touching the shared config or
 * fixtures/api-client.ts) by rewriting the URL ourselves before handing it to
 * a bare (no baseURL) request context, so a leading slash can't eat the path
 * prefix.
 */
const API_ORIGIN = new URL(API_BASE_URL).origin;
const API_PATH_PREFIX = new URL(API_BASE_URL).pathname.replace(/\/$/, "");
const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "fetch"]);

function withApiPrefix(ctx: APIRequestContext): APIRequestContext {
  return new Proxy(ctx, {
    get(target, prop, _receiver) {
      const value = (target as any)[prop];
      if (typeof prop === "string" && HTTP_METHODS.has(prop) && typeof value === "function") {
        return (url: string, ...rest: unknown[]) => {
          const fullUrl = url.startsWith("/") ? `${API_ORIGIN}${API_PATH_PREFIX}${url}` : url;
          return value.apply(target, [fullUrl, ...rest]);
        };
      }
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const test = base.extend<{}>({
  request: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext();
    await use(withApiPrefix(ctx));
    await ctx.dispose();
  },
});
export { expect };

/** Coordinates the seeded demo agents are set up around (matches tests/api/agent.spec.ts / booking.spec.ts). */
export const NEAR_LAT = 22.7196;
export const NEAR_LNG = 75.8577;

/** A minimal valid 1x1 transparent PNG, used as a stand-in "photo" for file-upload inputs. */
export const TINY_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

export const TINY_PNG_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export function tinyPngFile(name = "photo.png") {
  return { name, mimeType: "image/png", buffer: TINY_PNG_BUFFER };
}

async function firstPackageId(request: APIRequestContext): Promise<string> {
  const body = await (await request.get("/catalog/packages")).json();
  return body.data[0].id;
}

/** Puts the seeded demo agent online near NEAR_LAT/NEAR_LNG via the API. */
export async function goOnlineNear(request: APIRequestContext, token: string) {
  const res = await request.patch("/agent/online", {
    headers: authHeader(token),
    data: { online: true, lat: NEAR_LAT, lng: NEAR_LNG },
  });
  if (!res.ok()) {
    throw new Error(`goOnlineNear failed (${res.status()}): ${await res.text()}`);
  }
}

/**
 * Dispatch excludes an agent who already has an unfinished job from getting new
 * offers (see backend/src/modules/dispatch/dispatch.query.ts's "busy" post-filter
 * on ACTIVE_JOB_STATUSES). Since SEED_AGENT_PHONE is shared across every test in
 * this file, force-completes any job the agent is still mid-way through (assigned
 * / enroute / arrived / in_progress) before seeding a new one, so each test gets a
 * clean, eligible agent instead of racing dispatch and flaking with "agent never
 * received the offer".
 */
export async function completeAnyOpenJobsForAgent(request: APIRequestContext, agentToken: string): Promise<void> {
  for (let guard = 0; guard < 5; guard++) {
    const res = await request.get("/agent/jobs", { headers: authHeader(agentToken) });
    const jobs = ((await res.json()).data ?? []) as Array<{ id: string; status: string }>;
    const open = jobs.find((j) => j.status !== "completed");
    if (!open) return;

    for (let p = 0; p < 4; p++) {
      await request.post(`/agent/jobs/${open.id}/photo`, {
        headers: authHeader(agentToken),
        data: { kind: "before", image: TINY_PNG_DATA_URI },
      });
    }
    for (let p = 0; p < 4; p++) {
      await request.post(`/agent/jobs/${open.id}/photo`, {
        headers: authHeader(agentToken),
        data: { kind: "after", image: TINY_PNG_DATA_URI },
      });
    }

    for (let i = 0; i < 5; i++) {
      const advRes = await request.patch(`/agent/jobs/${open.id}/advance`, { headers: authHeader(agentToken) });
      const adv = await advRes.json();
      if (adv.data?.status === "completed") break;
    }
  }
}

/**
 * Decline whatever offer the seeded agent is already holding, if any.
 *
 * There is one demo agent shared by every agent spec, so it can still be
 * holding an offer for an earlier test's booking. `/agent/offers/current`
 * returns only that one offer, so seedAssignedJob would poll for its own
 * bookingId and keep seeing the older one — for up to OFFER_TTL_MS (25s by
 * default), well past its 12s poll window, and past the 30s test timeout once
 * setup is counted. That is the whole flake: nothing is broken, the helper was
 * just racing an offer TTL. Declining up front makes it deterministic.
 */
async function drainPendingOffers(request: APIRequestContext, agentToken: string): Promise<void> {
  // A handful of iterations: declining one offer can immediately cascade the
  // next queued booking to the same agent.
  for (let i = 0; i < 5; i++) {
    const res = await request.get("/agent/offers/current", { headers: authHeader(agentToken) });
    if (!res.ok()) return;
    const bookingId = (await res.json())?.data?.bookingId;
    if (!bookingId) return;
    await request.post(`/agent/offers/${bookingId}/decline`, { headers: authHeader(agentToken) });
  }
}

/**
 * Seeds a job that is ASSIGNED to the seeded demo agent (SEED_AGENT_PHONE),
 * bypassing the flaky real-time OfferOverlay UI popup: goes the agent online,
 * has a fresh customer create a booking at the same coordinates, polls for the
 * dispatch offer to land, then accepts it via the API.
 *
 * Returns the agent's bearer token/id and the resulting bookingId (job id).
 */
export async function seedAssignedJob(
  request: APIRequestContext,
): Promise<{ agentToken: string; agentId: string; bookingId: string }> {
  const { token: agentToken, userId: agentId } = await loginAsAgent(request);
  await completeAnyOpenJobsForAgent(request, agentToken);
  await goOnlineNear(request, agentToken);
  await drainPendingOffers(request, agentToken);

  const { token: customerToken } = await loginAsNewCustomer(request);
  const packageId = await firstPackageId(request);
  const created = await (
    await request.post("/bookings", {
      headers: authHeader(customerToken),
      data: {
        vehicleType: "hatchback",
        vehicleName: "Test Car",
        packageId,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        slot: "11:00 AM",
        addressLabel: "Home",
        addressLine: "123 Test Street",
        lat: NEAR_LAT,
        lng: NEAR_LNG,
      },
    })
  ).json();
  const bookingId = created.data.id;

  let offer: { data: { bookingId?: string } } | null = null;
  for (let i = 0; i < 30; i++) {
    const res = await request.get("/agent/offers/current", { headers: authHeader(agentToken) });
    const body = await res.json();
    if (body.data?.bookingId === bookingId) {
      offer = body;
      break;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  expect(offer, "agent never received the offer for this booking").not.toBeNull();

  const accept = await request.post(`/agent/offers/${bookingId}/accept`, { headers: authHeader(agentToken) });
  expect(accept.ok()).toBeTruthy();

  return { agentToken, agentId, bookingId };
}

export { SEED_AGENT_PHONE };
