import { z } from "zod";
import { VEHICLE_TYPES } from "../catalog/catalog.data";

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
});

export const requestPhoneChangeSchema = z.object({
  phone: z.string().min(7).max(20),
});

export const confirmPhoneChangeSchema = z.object({
  phone: z.string().min(7).max(20),
  code: z.string().min(4).max(8),
});

export const addVehicleSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  name: z.string().min(1).max(60),
  brand: z.string().max(40).optional(),
  model: z.string().max(40).optional(),
  plate: z.string().max(20).optional(),
});

export const addAddressSchema = z.object({
  label: z.string().min(1).max(40),
  line: z.string().min(1).max(120),
  society: z.string().max(80).optional(),
});
