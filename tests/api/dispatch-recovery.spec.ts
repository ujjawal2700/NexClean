import { test, expect } from "@playwright/test";
import mongoose, { Types } from "../../backend/node_modules/mongoose/index.js";
import { User } from "../../backend/src/modules/user/user.model";
import { Booking } from "../../backend/src/modules/booking/booking.model";
import { DispatchConfig } from "../../backend/src/modules/dispatch/dispatchConfig.model";
import { PayoutConfig } from "../../backend/src/modules/payout/payoutConfig.model";
import { getPayoutConfigDoc } from "../../backend/src/modules/payout/payoutConfig.service";
import { startDispatch, offerNext, getOfferForAgent, recoverDispatch, resumeDispatch, sweepOffers } from "../../backend/src/modules/dispatch/dispatch.service";
import { findNearestEligibleAgents } from "../../backend/src/modules/dispatch/dispatch.query";

// A separate, hardcoded LOCAL database: never connect to backend/.env or the
// server's test database. Real Mongo queries and compare-and-swap operations.
const point: [number, number] = [75.8577, 22.7196];
let phone = 0;
async function agent(patch: Record<string, unknown> = {}) {
  return User.create({ phone: `dispatch-${++phone}`, name: "Indore cleaner", role: "agent",
    online: true, lastSeenAt: new Date(), agentStatus: "verified",
    liveLocation: { type: "Point", coordinates: point }, ...patch });
}
async function booking(patch: Record<string, unknown> = {}) {
  return Booking.create({ user: new Types.ObjectId(), vehicleType: "sedan", vehicleName: "Test car",
    packageId: "test", packageName: "Wash", date: new Date(Date.now() + 86400_000), slot: "10:00 AM",
    addressLabel: "Home", addressLine: "Indore", price: 200, dispatchStatus: "searching",
    location: { type: "Point", coordinates: point }, ...patch });
}
test.beforeAll(async () => {
  await mongoose.connect("mongodb://127.0.0.1:27017/nexclean-dispatch-regression");
  await mongoose.connection.dropDatabase();
  await Promise.all([User.init(), Booking.init(), DispatchConfig.init(), PayoutConfig.init()]);
});
test.beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});
test.afterAll(async () => { await mongoose.disconnect(); });

test("queued job recovers when delayed GPS arrives", async () => {
  const a = await agent({ liveLocation: undefined });
  const b = await booking();
  await offerNext(String(b._id));
  expect((await Booking.findById(b._id))?.dispatchStatus).toBe("pending_admin");
  await User.updateOne({ _id: a._id }, { liveLocation: { type: "Point", coordinates: point } });
  await recoverDispatch();
  expect((await getOfferForAgent(String(a._id)))?.bookingId).toBe(String(b._id));
});

test("queued job recovers after agent goes online or completes another job", async () => {
  const a = await agent({ online: false });
  const b = await booking();
  await offerNext(String(b._id));
  await User.updateOne({ _id: a._id }, { online: true });
  const busy = await booking({ assignedAgent: a._id, dispatchStatus: "assigned" });
  await recoverDispatch();
  expect(await getOfferForAgent(String(a._id))).toBeNull();
  await Booking.updateOne({ _id: busy._id }, { status: "completed", jobStatus: "completed" });
  await recoverDispatch();
  expect((await getOfferForAgent(String(a._id)))?.bookingId).toBe(String(b._id));
});

test("nearby agent is found beyond 500 earlier fleet records in another city", async () => {
  await User.insertMany(Array.from({ length: 501 }, (_, i) => ({ phone: `far-${i}`, role: "agent",
    agentStatus: "verified", online: true, lastSeenAt: new Date(),
    liveLocation: { type: "Point", coordinates: [77.6, 12.9] } })));
  const a = await agent();
  const candidates = await findNearestEligibleAgents(point, 12_000);
  expect(candidates.map((c) => c.id)).toEqual([String(a._id)]);
});

test("retry preserves declines and excludes offline, suspended, unverified and unreachable agents", async () => {
  const declined = await agent();
  await agent({ online: false });
  await agent({ status: "suspended" });
  await agent({ agentStatus: "pending" });
  await agent({ lastSeenAt: new Date(0), deviceTokens: ["web-placeholder"] });
  const b = await booking({ declinedAgents: [declined._id] });
  await recoverDispatch();
  expect((await Booking.findById(b._id))?.dispatchStatus).toBe("pending_admin");
  const eligible = await agent();
  await recoverDispatch();
  expect((await getOfferForAgent(String(eligible._id)))?.bookingId).toBe(String(b._id));
  expect(await getOfferForAgent(String(declined._id))).toBeNull();
});

test("orphan reservation on an upcoming booking is reclaimed after its lease", async () => {
  const b = await booking({ dispatchStatus: "pending_admin" });
  const a = await agent({ currentOfferBooking: b._id, currentOfferLeaseUntil: new Date(0) });
  await recoverDispatch();
  expect((await getOfferForAgent(String(a._id)))?.bookingId).toBe(String(b._id));
  expect((await User.findById(a._id))?.currentOfferLeaseUntil?.getTime()).toBeGreaterThan(Date.now());
});

test("recovery does not release a reservation while its booking claim is in flight", async () => {
  const b = await booking();
  const a = await agent({ currentOfferBooking: b._id, currentOfferLeaseUntil: new Date(Date.now() + 90_000) });
  await recoverDispatch();
  expect(String((await User.findById(a._id))?.currentOfferBooking)).toBe(String(b._id));
  expect((await Booking.findById(b._id))?.dispatchStatus).toBe("pending_admin");
});

test("rolling restart preserves a live offer and its lock even with an expired lease", async () => {
  const a = await agent();
  const deadline = new Date(Date.now() + 60_000);
  const b = await booking({ dispatchStatus: "offered", currentOfferAgent: a._id, offerExpiresAt: deadline });
  await User.updateOne({ _id: a._id }, { currentOfferBooking: b._id, currentOfferLeaseUntil: new Date(0) });
  await resumeDispatch();
  const restored = await getOfferForAgent(String(a._id));
  expect(restored?.bookingId).toBe(String(b._id));
  expect(new Date(restored!.expiresAt!).getTime()).toBe(deadline.getTime());
  expect(String((await User.findById(a._id))?.currentOfferBooking)).toBe(String(b._id));
});

test("concurrent dispatch for two jobs reserves an agent only once", async () => {
  const a = await agent();
  const jobs = await Promise.all([booking(), booking()]);
  await Promise.all(jobs.map((b) => offerNext(String(b._id))));
  const offered = await Booking.find({ dispatchStatus: "offered" });
  expect(offered).toHaveLength(1);
  expect(String(offered[0].currentOfferAgent)).toBe(String(a._id));
  expect(String((await User.findById(a._id))?.currentOfferBooking)).toBe(String(offered[0]._id));
});

test("concurrent dispatch of the same job publishes one offer without abandoned locks", async () => {
  await Promise.all([agent(), agent()]);
  const b = await booking();
  await Promise.all(Array.from({ length: 5 }, () => startDispatch(String(b._id))));
  const offered = await Booking.findById(b._id);
  const reserved = await User.find({ currentOfferBooking: b._id });
  expect(reserved).toHaveLength(1);
  expect(String(reserved[0]._id)).toBe(String(offered?.currentOfferAgent));
  expect(offered?.dispatchAttempts).toBe(1);
});

test("configuration read failure does not reserve an agent and next recovery succeeds", async () => {
  const a = await agent();
  const b = await booking();
  const original = DispatchConfig.findById;
  try {
    DispatchConfig.findById = (() => { throw new Error("temporary DB failure"); }) as any;
    await expect(offerNext(String(b._id))).rejects.toThrow("temporary DB failure");
    expect((await User.findById(a._id))?.currentOfferBooking).toBeNull();
  } finally { DispatchConfig.findById = original; }
  await recoverDispatch();
  expect((await getOfferForAgent(String(a._id)))?.bookingId).toBe(String(b._id));
});

test("expired offer advances to the next agent and remains recoverable by REST", async () => {
  const a = await agent();
  const next = await agent({ liveLocation: { type: "Point", coordinates: [point[0] + 0.001, point[1]] } });
  const b = await booking();
  await offerNext(String(b._id));
  expect((await getOfferForAgent(String(a._id)))?.bookingId).toBe(String(b._id));
  await Booking.updateOne({ _id: b._id }, { offerExpiresAt: new Date(0) });
  await sweepOffers();
  expect(await getOfferForAgent(String(a._id))).toBeNull();
  expect((await getOfferForAgent(String(next._id)))?.bookingId).toBe(String(b._id));
});

test("simultaneous first payout reads create one rule without dropping offers", async () => {
  const configs = await Promise.all(Array.from({ length: 10 }, () => getPayoutConfigDoc()));
  expect(configs.every((c) => c._id === "global")).toBe(true);
  expect(await PayoutConfig.countDocuments()).toBe(1);
});

test("legacy abandoned lock gets one lease even while heartbeats continue", async () => {
  const b = await booking();
  const a = await agent({ currentOfferBooking: b._id });
  await recoverDispatch();
  const stamped = (await User.findById(a._id))?.currentOfferLeaseUntil;
  expect(stamped?.getTime()).toBeGreaterThan(Date.now());
  await User.updateOne({ _id: a._id }, { lastSeenAt: new Date() });
  await recoverDispatch();
  expect((await User.findById(a._id))?.currentOfferLeaseUntil?.getTime()).toBe(stamped?.getTime());
  await User.updateOne({ _id: a._id }, { currentOfferLeaseUntil: new Date(0) });
  await recoverDispatch();
  expect((await getOfferForAgent(String(a._id)))?.bookingId).toBe(String(b._id));
});

test("one failed booking recovery does not block other queued jobs", async () => {
  const broken = await booking();
  const good = await booking();
  const a = await agent();
  const original = Booking.findById;
  try {
    Booking.findById = ((id: unknown, ...args: unknown[]) => {
      if (String(id) === String(broken._id)) throw new Error("single booking failure");
      return (original as any).call(Booking, id, ...args);
    }) as any;
    await recoverDispatch();
  } finally { Booking.findById = original; }
  expect((await getOfferForAgent(String(a._id)))?.bookingId).toBe(String(good._id));
});

test("cancelled, assigned and future scheduled jobs are not reopened by recovery", async () => {
  const a = await agent();
  const cancelled = await booking({ status: "cancelled", dispatchStatus: "pending_admin" });
  const assigned = await booking({ assignedAgent: a._id, dispatchStatus: "pending_admin" });
  const scheduled = await booking({ dispatchStatus: "scheduled", isSubscriptionWash: true });
  await Promise.all([cancelled, assigned, scheduled].map((b) => startDispatch(String(b._id))));
  await recoverDispatch();
  expect(await Booking.countDocuments({ dispatchStatus: "offered" })).toBe(0);
  expect((await Booking.findById(cancelled._id))?.status).toBe("cancelled");
  expect(String((await Booking.findById(assigned._id))?.assignedAgent)).toBe(String(a._id));
  expect((await Booking.findById(scheduled._id))?.dispatchStatus).toBe("scheduled");
});

test("failure between reservation and booking claim is repaired after the lease", async () => {
  const a = await agent();
  const b = await booking();
  const original = Booking.findOneAndUpdate;
  try {
    Booking.findOneAndUpdate = (() => { throw new Error("claim DB unavailable"); }) as any;
    await expect(offerNext(String(b._id))).rejects.toThrow("claim DB unavailable");
  } finally { Booking.findOneAndUpdate = original; }
  expect(String((await User.findById(a._id))?.currentOfferBooking)).toBe(String(b._id));
  await User.updateOne({ _id: a._id }, { currentOfferLeaseUntil: new Date(0) });
  await recoverDispatch();
  expect((await getOfferForAgent(String(a._id)))?.bookingId).toBe(String(b._id));
});

test("payload delivery failure retains a single authoritative offer for REST recovery", async () => {
  const a = await agent();
  const b = await booking();
  const original = PayoutConfig.findByIdAndUpdate;
  try {
    PayoutConfig.findByIdAndUpdate = (() => { throw new Error("temporary payout read failure"); }) as any;
    await expect(offerNext(String(b._id))).rejects.toThrow("temporary payout read failure");
  } finally { PayoutConfig.findByIdAndUpdate = original; }
  await recoverDispatch();
  expect((await getOfferForAgent(String(a._id)))?.bookingId).toBe(String(b._id));
  expect((await Booking.findById(b._id))?.dispatchAttempts).toBe(1);
});

test("a live booking still excludes its agent if a historical restart lost the reservation", async () => {
  const a = await agent();
  const offered = await booking({ dispatchStatus: "offered", currentOfferAgent: a._id,
    offerExpiresAt: new Date(Date.now() + 60_000) });
  const next = await booking();
  await recoverDispatch();
  expect((await Booking.findById(next._id))?.dispatchStatus).toBe("pending_admin");
  expect((await getOfferForAgent(String(a._id)))?.bookingId).toBe(String(offered._id));
});
