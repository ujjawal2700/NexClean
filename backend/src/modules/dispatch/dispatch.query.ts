import { Types } from "mongoose";
import { User } from "../user/user.model";
import { Booking } from "../booking/booking.model";
import { agentLiveSince } from "../user/presence";
import type { LngLat } from "../../shared/geo";
import { MAX_CANDIDATES } from "./dispatch.config";

export type NearbyAgent = {
  id: string;
  name: string;
  distanceM: number;
};

/** Job statuses that make an agent "busy" and ineligible for a new offer. */
const ACTIVE_JOB_STATUSES = ["assigned", "enroute", "arrived", "in_progress"];

/**
 * Return verified, live, unoccupied agents within `radiusM` of `point`,
 * ordered nearest-first. Excludes agents who already hold an offer, who have
 * declined this job, or who are mid-job on another booking.
 */
export async function findNearestEligibleAgents(
  point: LngLat,
  radiusM: number,
  excludeAgentIds: (string | Types.ObjectId)[] = [],
  limit = MAX_CANDIDATES,
): Promise<NearbyAgent[]> {
  const exclude = excludeAgentIds.map((id) => new Types.ObjectId(String(id)));

  const candidates = await User.aggregate<{ _id: Types.ObjectId; name: string; distanceM: number }>([
    {
      $geoNear: {
        near: { type: "Point", coordinates: point },
        distanceField: "distanceM",
        maxDistance: radiusM,
        spherical: true,
        query: {
          role: "agent",
          agentStatus: "verified",
          online: true,
          lastSeenAt: { $gte: agentLiveSince() },
          currentOfferBooking: null,
          ...(exclude.length ? { _id: { $nin: exclude } } : {}),
        },
      },
    },
    { $limit: MAX_CANDIDATES },
    { $project: { name: 1, distanceM: 1 } },
  ]);

  if (candidates.length === 0) return [];

  // Post-filter agents who are mid-job on another booking.
  const busy = await Booking.find({
    assignedAgent: { $in: candidates.map((c) => c._id) },
    jobStatus: { $in: ACTIVE_JOB_STATUSES },
    status: "upcoming",
  }).distinct("assignedAgent");
  const busyIds = new Set(busy.map((id) => String(id)));

  return candidates
    .filter((c) => !busyIds.has(String(c._id)))
    .slice(0, limit)
    .map((c) => ({ id: String(c._id), name: c.name, distanceM: Math.round(c.distanceM) }));
}
