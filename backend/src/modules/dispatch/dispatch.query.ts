import { Types } from "mongoose";
import { User } from "../user/user.model";
import { Booking } from "../booking/booking.model";
import { ServiceZone } from "../location/location.model";
import { agentLiveSince } from "../user/presence";
import { haversineMeters, orderZonesByDistance, pointInPolygon, type LngLat } from "../../shared/geo";
import { MAX_CANDIDATES, MAX_FETCHED_AGENTS, MAX_SEARCH_RADIUS_M } from "./dispatch.config";

export type NearbyAgent = {
  id: string;
  name: string;
  distanceM: number;
};

/** Job statuses that make an agent "busy" and ineligible for a new offer. */
const ACTIVE_JOB_STATUSES = ["assigned", "enroute", "arrived", "in_progress"];

/**
 * One step of a dispatch search, nearest to farthest. A zone tier restricts
 * candidates to agents physically inside `ring` right now (true geofencing —
 * there is no stored agent→zone assignment); the final tier is always the
 * old flat-radius search, so a booking or fleet with zero zones configured
 * behaves exactly as before.
 */
export type DispatchTier = {
  zoneId: string | null;
  zoneName: string | null;
  ring: LngLat[] | null;
  /**
   * The actual outer bound used to fetch/filter candidates for this tier.
   * For a zone tier this is deliberately generous (MAX_SEARCH_RADIUS_M) —
   * polygon containment is the real constraint, not distance, so this must
   * never be tighter than the zone's own extent or it would wrongly exclude
   * an agent standing on the far side of a large zone.
   */
  filterRadiusM: number;
  /** A real, monotonically non-decreasing "how far are we looking" value for the customer-facing progress UI — distinct from filterRadiusM on purpose. */
  displayRadiusM: number;
};

type EligibleAgent = { id: string; name: string; coordinates: LngLat };

/** Fetch the raw pool of agents eligible for a new offer, unordered. */
async function fetchEligibleAgents(excludeAgentIds: (string | Types.ObjectId)[]): Promise<EligibleAgent[]> {
  const exclude = excludeAgentIds.map((id) => new Types.ObjectId(String(id)));
  const docs = await User.find({
    role: "agent",
    agentStatus: "verified",
    online: true,
    lastSeenAt: { $gte: agentLiveSince() },
    currentOfferBooking: null,
    "liveLocation.coordinates": { $exists: true },
    ...(exclude.length ? { _id: { $nin: exclude } } : {}),
  })
    .select("name liveLocation")
    .limit(MAX_FETCHED_AGENTS)
    .lean();

  return docs
    .map((d) => ({
      id: String(d._id),
      name: d.name,
      coordinates: (d.liveLocation as unknown as { coordinates?: number[] } | undefined)?.coordinates as
        | LngLat
        | undefined,
    }))
    .filter((a): a is EligibleAgent => Array.isArray(a.coordinates) && a.coordinates.length === 2);
}

/**
 * Pure ranking step: given a fetched agent pool and one dispatch tier, return
 * the ones eligible for that tier ordered nearest-first. Kept separate from
 * the DB fetch above so the actual "nearby to far" selection is directly
 * unit-testable without Mongo.
 */
export function rankAgentsForTier(
  point: LngLat,
  agents: EligibleAgent[],
  tier: { ring?: LngLat[] | null; radiusM: number },
): NearbyAgent[] {
  return agents
    .map((a) => ({ ...a, distanceM: haversineMeters(point, a.coordinates) }))
    .filter((a) => (tier.ring ? pointInPolygon(a.coordinates, tier.ring) : true) && a.distanceM <= tier.radiusM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .map((a) => ({ id: a.id, name: a.name, distanceM: Math.round(a.distanceM) }));
}

/**
 * Return verified, live, unoccupied agents eligible for `point`, ordered
 * nearest-first. Excludes agents who already hold an offer, who have
 * declined this job, or who are mid-job on another booking.
 *
 * When `ring` is given, restricts to agents currently physically inside it
 * (a zone geofence) regardless of `radiusM` beyond that — `radiusM` still
 * applies as an outer bound either way.
 */
export async function findNearestEligibleAgents(
  point: LngLat,
  radiusM: number,
  excludeAgentIds: (string | Types.ObjectId)[] = [],
  limit = MAX_CANDIDATES,
  ring?: LngLat[] | null,
): Promise<NearbyAgent[]> {
  const pool = await fetchEligibleAgents(excludeAgentIds);
  if (pool.length === 0) return [];

  const ranked = rankAgentsForTier(point, pool, { ring, radiusM });
  if (ranked.length === 0) return [];

  // Post-filter agents who are mid-job on another booking.
  const busy = await Booking.find({
    assignedAgent: { $in: ranked.map((c) => new Types.ObjectId(c.id)) },
    jobStatus: { $in: ACTIVE_JOB_STATUSES },
    status: "upcoming",
  }).distinct("assignedAgent");
  const busyIds = new Set(busy.map((id) => String(id)));

  return ranked.filter((c) => !busyIds.has(c.id)).slice(0, limit);
}

/**
 * Build this booking's ordered search plan: every active geofenced zone,
 * nearest to farthest from `point` (the zone containing it, if any, always
 * first at distance 0), followed by one final flat-radius tier that isn't
 * restricted to any polygon. That last tier is what makes this a strict
 * superset of the old circles-only search — zero zones configured produces
 * exactly one tier, identical to today's behavior.
 */
export async function buildDispatchTiers(point: LngLat): Promise<DispatchTier[]> {
  const zones = await ServiceZone.find({ active: true }).select("name boundary").lean();
  const withRing = zones
    .map((z) => ({
      id: String(z._id),
      name: z.name,
      boundaryRing: (z.boundary?.coordinates?.[0] ?? []) as LngLat[],
    }))
    .filter((z) => z.boundaryRing.length >= 3);

  const ordered = orderZonesByDistance(point, withRing);

  const tiers: DispatchTier[] = [];
  let runningMax = 0;
  for (const z of ordered) {
    runningMax = Math.max(runningMax, z.distanceM, 500);
    tiers.push({
      zoneId: z.id,
      zoneName: z.name,
      ring: z.boundaryRing,
      filterRadiusM: MAX_SEARCH_RADIUS_M,
      displayRadiusM: runningMax,
    });
  }
  runningMax = Math.max(runningMax, MAX_SEARCH_RADIUS_M);
  tiers.push({ zoneId: null, zoneName: null, ring: null, filterRadiusM: MAX_SEARCH_RADIUS_M, displayRadiusM: runningMax });
  return tiers;
}

/**
 * Walk `tiers` from `startIdx`, returning the first tier with any eligible
 * candidate. Shared by the on-demand offer loop (which needs the tier index
 * to persist/resume from) and the one-shot "assign nearest now" paths.
 */
export async function findAcrossTiers(
  point: LngLat,
  tiers: DispatchTier[],
  startIdx: number,
  excludeAgentIds: (string | Types.ObjectId)[],
  limit: number,
): Promise<{ tierIndex: number; candidates: NearbyAgent[] } | null> {
  for (let i = Math.max(0, startIdx); i < tiers.length; i++) {
    const tier = tiers[i];
    const candidates = await findNearestEligibleAgents(point, tier.filterRadiusM, excludeAgentIds, limit, tier.ring);
    if (candidates.length) return { tierIndex: i, candidates };
  }
  return null;
}
