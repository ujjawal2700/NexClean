import { City, ServiceZone, type CityDoc } from "./location.model";
import { User } from "../user/user.model";
import { ApiError } from "../../shared/utils/ApiError";

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
    cityId: (city && typeof city === "object" && city.id) || String(z.city),
    cityName: (city && typeof city === "object" && city.name) || "",
    active: z.active,
    color: z.color || "#4F7CFF",
    boundary: z.boundary,
    coordinates,
    pincodes: z.pincodes || [],
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

export async function listZones() {
  const zones = await ServiceZone.find().populate("city", "name").sort({ name: 1 });
  const agentCounts = await User.aggregate<{ _id: any; count: number }>([
    { $match: { role: "agent", zoneId: { $ne: null } } },
    { $group: { _id: "$zoneId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map<string, number>();
  for (const ac of agentCounts) {
    countMap.set(String(ac._id), ac.count);
  }
  return zones.map((z) => mapZone(z, countMap.get(String(z._id)) || 0));
}

export async function createZone(input: {
  name: string;
  cityId: string;
  color?: string;
  coordinates?: [number, number][];
  pincodes?: string[];
  active?: boolean;
}) {
  const city = await City.findById(input.cityId);
  if (!city) throw ApiError.badRequest("Unknown city");

  let boundary = undefined;
  if (input.coordinates && Array.isArray(input.coordinates) && input.coordinates.length >= 3) {
    let coords = input.coordinates;
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords = [...coords, [first[0], first[1]]];
    }
    boundary = {
      type: "Polygon",
      coordinates: [coords],
    };
  }

  const zone = await ServiceZone.create({
    name: input.name,
    city: city.id,
    color: input.color || "#4F7CFF",
    boundary,
    pincodes: input.pincodes || [],
    active: input.active !== undefined ? input.active : true,
  });
  return mapZone(await zone.populate("city", "name"));
}

export async function updateZone(
  id: string,
  patch: {
    name?: string;
    active?: boolean;
    cityId?: string;
    color?: string;
    coordinates?: [number, number][];
    pincodes?: string[];
  },
) {
  const zone = await ServiceZone.findById(id);
  if (!zone) throw ApiError.notFound("Zone not found");
  if (patch.name !== undefined) zone.name = patch.name;
  if (patch.active !== undefined) zone.active = patch.active;
  if (patch.color !== undefined) zone.color = patch.color;
  if (patch.pincodes !== undefined) zone.pincodes = patch.pincodes;
  if (patch.cityId !== undefined) {
    const city = await City.findById(patch.cityId);
    if (!city) throw ApiError.badRequest("Unknown city");
    zone.city = city.id;
  }
  if (patch.coordinates !== undefined) {
    if (Array.isArray(patch.coordinates) && patch.coordinates.length >= 3) {
      let coords = patch.coordinates;
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coords = [...coords, [first[0], first[1]]];
      }
      zone.boundary = {
        type: "Polygon",
        coordinates: [coords],
      };
    } else {
      zone.boundary = undefined;
    }
  }
  await zone.save();
  const agentCount = await User.countDocuments({ role: "agent", zoneId: zone.id });
  return mapZone(await zone.populate("city", "name"), agentCount);
}

export async function deleteZone(id: string) {
  const zone = await ServiceZone.findByIdAndDelete(id);
  if (!zone) throw ApiError.notFound("Zone not found");
}

export async function listAgentsInZone(zoneId: string) {
  const agents = await User.find({ role: "agent", zoneId }).select(
    "name phone email area rating jobsDone online agentStatus",
  );
  return agents.map((a) => ({
    id: a.id,
    name: a.name,
    phone: a.phone,
    email: a.email,
    area: a.area,
    rating: a.rating,
    jobsDone: a.jobsDone,
    online: a.online,
    status: a.agentStatus,
  }));
}
