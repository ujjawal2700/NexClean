import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
});

export const changePasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  code: z.string().min(4, "OTP code is required"),
});


export const requestPhoneChangeSchema = z.object({
  phone: z.string().min(7).max(20),
});

export const confirmPhoneChangeSchema = z.object({
  phone: z.string().min(7).max(20),
  code: z.string().min(4).max(8),
});

export const addVehicleSchema = z.object({
  type: z.string().min(1),
  name: z.string().min(1).max(60),
  brand: z.string().max(40).optional(),
  model: z.string().max(40).optional(),
  plate: z.string().max(20).optional(),
});

export const addAddressSchema = z.object({
  label: z.string().min(1).max(40),
  line: z.string().min(1).max(120),
  society: z.string().max(80).optional(),
  // Geo captured from Google Places (optional; enables nearest-agent dispatch).
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  placeId: z.string().max(200).optional(),
});
