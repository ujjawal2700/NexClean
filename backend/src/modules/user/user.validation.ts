import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(60)
    // Unicode-aware: the ASCII-only version rejected "José" and any name typed
    // in Devanagari or another Indian script, which real customers here do.
    // \p{L} covers letters in every script, \p{M} the combining marks that
    // Indic vowel signs rely on.
    .regex(/^[\p{L}\p{M}\s.'-]+$/u, "Name must contain letters only, no numbers or special symbols")
    .optional(),
  email: z.string().trim().email("Enter a valid email address").max(120).optional().or(z.literal("")),
  phone: z
    .string()
    .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits")
    .optional()
    .or(z.literal("")),
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
  label: z.string().min(1).max(60),
  line: z.string().min(1).max(500),
  society: z.string().max(150).optional(),
  // Geo captured from map pin / Google Places (optional; enables nearest-agent dispatch).
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  placeId: z.string().max(200).optional(),
});

export const updateAddressSchema = addAddressSchema.partial();
