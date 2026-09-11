import { City, ServiceZone, type CityDoc } from "./location.model";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import { isSimplePolygon, pointInPolygon, type LngLat } from "../../shared/geo";
import { agentLiveSince } from "../user/presence";

function mapCity(c: CityDoc) {
  return { id: c.id, name: c.name, active: c.active };
}

function mapZone(z: any, agentCount = 0) {
  const city = z.city as unknown as { id?: string; name?: string } | null;
  const boundary = z.boundary;
  const coordinates = boundary?.coordinates?.[0] || [];
  return {
    id: z.id || String(z._id),
    name: z.name,
    cityId: (city && typeof city === "object" && city.id) || (z.city ? String(z.city) : null),
    cityName: (city && typeof city === "object" && city.name) || "",
    active: z.active,
    color: z.color || "#4F7CFF",
    boundary: z.boundary,
    coordinates,
    agentCount,
  };
}

export async function listCities() {
  const cities = await City.find().sort({ name: 1 });
  return cities.map(mapCity);
}

export async function createCity(input: { name: string }) {
  const existing = await City.findOne({ name: input.name });
  if (existing) throw ApiError.badRequest("City already exists");
  return mapCity(await City.create({ name: input.name }));
}

export async function updateCity(id: string, patch: { name?: string; active?: boolean }) {
  const city = await City.findByIdAndUpdate(id, patch, { new: true });
  if (!city) throw ApiError.notFound("City not found");
  return mapCity(city);
}

export async function deleteCity(id: string) {
  const zoneCount = await ServiceZone.countDocuments({ city: id });
  if (zoneCount > 0) throw ApiError.badRequest("Remove the zones in this city first");
  const city = await City.findByIdAndDelete(id);
  if (!city) throw ApiError.notFound("City not found");
}

type LiveAgentPosition = {
  id: string;
  name: string;
  phone: string;
  email: string;
  area: string;
  rating: number;
  jobsDone: number;
  online: boolean;
  status: string;
  point: LngLat;
};

/**
 * Verified, currently-live agents with a usable GPS fix — the pool that
 * "which zone is this agent in" checks against. There is no stored
 * agent→zone assignment (see user.model.ts): coverage is computed fresh each
 * call by testing each agent's live point against each zone's polygon, the
 * same primitive dispatch uses to route jobs.
 */
async function liveAgentPositions(): Promise<LiveAgentPosition[]> {
  const agents = await User.find({
    role: "agent",
    agentStatus: "verified",
    online: true,
    lastSeenAt: { $gte: agentLiveSince() },
    "liveLocation.coordinates": { $exists: true },
  }).select("name phone email area rating jobsDone online agentStatus liveLocation");

  const positions: LiveAgentPosition[] = [];
  for (const a of agents) {
    const coords = (a.liveLocation as unknown as { coordinates?: number[] } | undefined)?.coordinates;
    if (!coords || coords.length !== 2) continue;
    positions.push({
      id: a.id,
      name: a.name,
      phone: a.phone,
      email: a.email,
      area: a.area,
      rating: a.rating,
      jobsDone: a.jobsDone,
      online: a.online,
      status: a.agentStatus,
      point: coords as LngLat,
    });
  }
  return positions;
}

function boundaryRing(zone: { boundary?: { coordinates?: number[][][] } }): LngLat[] {
  const ring = zone.boundary?.coordinates?.[0];
  return ring && ring.length >= 3 ? (ring as LngLat[]) : [];
}

export async function listZones() {
  const [zones, liveAgents] = await Promise.all([
    ServiceZone.find().populate("city", "name").sort({ name: 1 }),
    liveAgentPositions(),
  ]);
  return zones.map((z) => {
    const ring = boundaryRing(z);
    const agentCount = ring.length ? liveAgents.filter((a) => pointInPolygon(a.point, ring)).length : 0;
    return mapZone(z, agentCount);
  });
}

/** Close an open ring (repeat the first point as the last) if the caller didn't already. */
function closeRing(coords: [number, number][]): [number, number][] {
  const first = coords[0];
  const last = coords[coords.length - 1];
  return first[0] !== last[0] || first[1] !== last[1] ? [...coords, [first[0], first[1]]] : coords;
}

/**
 * Close the ring and reject a self-crossing boundary. Server-side authority
 * for this — the admin UI also checks while drawing, but the API itself must
 * not accept a bowtie shape regardless of caller, since pointInPolygon (and
 * therefore every dispatch/coverage query) gives ill-defined answers for one.
 */
function buildValidBoundary(coordinates: [number, number][]): { type: "Polygon"; coordinates: [number, number][][] } {
  const ring = closeRing(coordinates);
  if (!isSimplePolygon(ring as LngLat[])) {
    throw ApiError.badRequest("This boundary crosses itself — a zone can't be a self-intersecting shape");
  }
  return { type: "Polygon", coordinates: [ring] };
}

export async function createZone(input: {
  name: string;
  // Optional: a zone is a standalone geofence. A city link only matters to
  // the customer/agent signup "pick your society" pickers, which query zones
  // by city — set it only when this zone should show up there.
  cityId?: string;
  color?: string;
  coordinates: [number, number][];
  active?: boolean;
}) {
  let cityRef: string | null = null;
  if (input.cityId) {
    const city = await City.findById(input.cityId);
    if (!city) throw ApiError.badRequest("Unknown city");
    cityRef = city.id;
  }

  if (!Array.isArray(input.coordinates) || input.coordinates.length < 3) {
    throw ApiError.badRequest("A zone needs a boundary with at least 3 points");
  }

  const zone = await ServiceZone.create({
    name: input.name,
    city: cityRef,
    color: input.color || "#4F7CFF",
    boundary: buildValidBoundary(input.coordinates),
    active: input.active !== undefined ? input.active : true,
  });
  return mapZone(await zone.populate("city", "name"));
}

export async function updateZone(
  id: string,
  patch: {
    name?: string;
    active?: boolean;
    cityId?: string | null;
    color?: string;
    coordinates?: [number, number][];
  },
) {
  const zone = await ServiceZone.findById(id);
  if (!zone) throw ApiError.notFound("Zone not found");
  if (patch.name !== undefined) zone.name = patch.name;
  if (patch.active !== undefined) zone.active = patch.active;
  if (patch.color !== undefined) zone.color = patch.color;
  if (patch.cityId !== undefined) {
    if (patch.cityId === null) {
      zone.city = null as any;
    } else {
      const city = await City.findById(patch.cityId);
      if (!city) throw ApiError.badRequest("Unknown city");
      zone.city = city.id;
    }
  }
  if (patch.coordinates !== undefined) {
    if (!Array.isArray(patch.coordinates) || patch.coordinates.length < 3) {
      throw ApiError.badRequest("A zone needs a boundary with at least 3 points");
    }
    zone.boundary = buildValidBoundary(patch.coordinates);
  }
  await zone.save();

  const populated = await zone.populate("city", "name");
  const ring = boundaryRing(zone);
  const liveAgents = ring.length ? await liveAgentPositions() : [];
  const agentCount = liveAgents.filter((a) => pointInPolygon(a.point, ring)).length;
  return mapZone(populated, agentCount);
}

/**
 * Whether a point falls inside any active geofenced zone — the backing check
 * for "we're not in your area yet" at address-add time (see lead.service.ts's
 * requestArea for the accompanying "request this area" capture).
 *
 * `zonesConfigured: false` means no admin has drawn any active zone yet, in
 * which case `serviceable` is always true — geofencing is opt-in, and a fresh
 * deployment with zero zones must not reject every address, the same
 * "absence of zones means unrestricted" rule dispatch's buildDispatchTiers
 * already follows.
 */
export async function checkServiceability(point: LngLat): Promise<{ serviceable: boolean; zonesConfigured: boolean }> {
  const zones = await ServiceZone.find({ active: true }).select("boundary").lean();
  const rings = zones.map((z) => boundaryRing(z)).filter((r) => r.length >= 3);
  if (rings.length === 0) return { serviceable: true, zonesConfigured: false };
  return { serviceable: rings.some((ring) => pointInPolygon(point, ring)), zonesConfigured: true };
}

export async function deleteZone(id: string) {
  const zone = await ServiceZone.findByIdAndDelete(id);
  if (!zone) throw ApiError.notFound("Zone not found");
}

/** Agents currently, live, physically inside this zone's polygon — not a static assignment. */
export async function listAgentsInZone(zoneId: string) {
  const zone = await ServiceZone.findById(zoneId).select("boundary");
  const ring = zone ? boundaryRing(zone) : [];
  if (!ring.length) return [];

  const liveAgents = await liveAgentPositions();
  return liveAgents.filter((a) => pointInPolygon(a.point, ring)).map(({ point: _point, ...rest }) => rest);
}
