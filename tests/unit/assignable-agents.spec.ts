import { test, expect } from "@playwright/test";
import { Types } from "../../backend/node_modules/mongoose/index.js";
import { User } from "../../backend/src/modules/user/user.model";
import { Booking } from "../../backend/src/modules/booking/booking.model";
import { listAssignableAgents } from "../../backend/src/modules/dispatch/dispatch.service";

test("manual picker includes verified online agents without GPS, ranked after located agents", async () => {
  const bookingId = new Types.ObjectId();
  const busyId = new Types.ObjectId();
  const originalUserFind = User.find;
  const originalBookingFind = Booking.find;
  const originalBookingById = Booking.findById;
  let filter: any;
  try {
    Booking.findById = (() => Promise.resolve({ _id: bookingId, location: { coordinates: [75.8577, 22.7196] } })) as any;
    Booking.find = (() => ({ distinct: () => Promise.resolve([busyId]) })) as any;
    User.find = ((query: unknown) => {
      filter = query;
      return { select: () => ({ lean: () => Promise.resolve([
        { _id: "no-gps", name: "New Indore Cleaner", area: "Indore" },
        { _id: "nearby", name: "Nearby Cleaner", area: "Indore", liveLocation: { coordinates: [75.8577, 22.7196] } },
      ]) }) };
    }) as any;
    const agents = await listAssignableAgents(String(bookingId));
    expect(agents.map((a) => a.id)).toEqual(["nearby", "no-gps"]);
    expect(agents[1].distanceKm).toBeNull();
    expect(filter.online).toBe(true);
    expect(filter.agentStatus).toBe("verified");
    expect(filter._id.$nin).toEqual([busyId]);
    expect(filter.currentOfferBooking.$in).toEqual([null, bookingId]);
    expect(filter.liveLocation).toBeUndefined();
  } finally {
    User.find = originalUserFind;
    Booking.find = originalBookingFind;
    Booking.findById = originalBookingById;
  }
});
