import { City, ServiceZone, type CityDoc, type ZoneDoc } from "./location.model";
import { ApiError } from "../../shared/utils/ApiError";

function mapCity(c: CityDoc) {
  return { id: c.id, name: c.name, active: c.active };
}

function mapZone(z: ZoneDoc) {
  const city = z.city as unknown as { id?: string; name?: string } | null;
  return {
    id: z.id,
    name: z.name,
    cityId: (city && typeof city === "object" && city.id) || String(z.city),
    cityName: (city && typeof city === "object" && city.name) || "",
    active: z.active,
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
  return zones.map(mapZone);
}

export async function createZone(input: { name: string; cityId: string }) {
  const city = await City.findById(input.cityId);
  if (!city) throw ApiError.badRequest("Unknown city");
  const zone = await ServiceZone.create({ name: input.name, city: city.id });
  return mapZone(await zone.populate("city", "name"));
}

export async function updateZone(id: string, patch: { name?: string; active?: boolean; cityId?: string }) {
  const zone = await ServiceZone.findById(id);
  if (!zone) throw ApiError.notFound("Zone not found");
  if (patch.name !== undefined) zone.name = patch.name;
  if (patch.active !== undefined) zone.active = patch.active;
  if (patch.cityId !== undefined) {
    const city = await City.findById(patch.cityId);
    if (!city) throw ApiError.badRequest("Unknown city");
    zone.city = city.id;
  }
  await zone.save();
  return mapZone(await zone.populate("city", "name"));
}

export async function deleteZone(id: string) {
  const zone = await ServiceZone.findByIdAndDelete(id);
  if (!zone) throw ApiError.notFound("Zone not found");
}
