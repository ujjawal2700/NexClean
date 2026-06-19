import { z } from "zod";

export const sendOtpSchema = z.object({
  phone: z.string().regex(/^\+?[\d\s]{10,15}$/, "Enter a valid phone number"),
});

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+?[\d\s]{10,15}$/, "Enter a valid phone number"),
  code: z.string().length(6, "Code must be 6 digits"),
});

export const adminLoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
