import { z } from "zod";
import { VEHICLE_TYPES } from "../catalog/catalog.data";

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(60),
});

export const addVehicleSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  name: z.string().min(1).max(60),
  plate: z.string().max(20).optional(),
});

export const addAddressSchema = z.object({
  label: z.string().min(1).max(40),
  line: z.string().min(1).max(120),
  society: z.string().max(80).optional(),
});
