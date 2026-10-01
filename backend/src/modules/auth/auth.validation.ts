import { z } from "zod";

export const sendOtpSchema = z.object({
  phone: z.string().regex(/^\+?[\d\s]{10,15}$/, "Enter a valid phone number"),
  /** Which app is logging in; lets login-OTP reject a number of the wrong kind up front. */
  role: z.enum(["customer", "agent"]).optional(),
});

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+?[\d\s]{10,15}$/, "Enter a valid phone number"),
  code: z.string().length(6, "Code must be 6 digits"),
});

export const adminLoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const adminPasswordResetRequestSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(120),
});

export const adminPasswordResetSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(120),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit reset code"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/\d/, "Password must include a number"),
});

export const referralCheckSchema = z.object({
  code: z.string().trim().min(1, "Enter a referral code").max(32),
  // Optional: lets the check refuse the customer's own code up front.
  phone: z.string().regex(/^\+?[\d\s]{10,15}$/).optional(),
});

export const customerSignupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().regex(/^\+?[\d\s]{10,15}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  referralCode: z.string().trim().min(1).optional().or(z.literal("")),
  // Stable per-install id from the client, paired with the request IP to spot
  // referral farming. Optional so older clients keep working.
  deviceId: z.string().trim().max(128).optional(),
  privacyAccepted: z.literal(true, { errorMap: () => ({ message: "Privacy Policy acceptance is required" }) }),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: "Terms & Conditions acceptance is required" }) }),
});

const dataUri = z
  .string()
  .max(500_000, "Image is too large. Convert it to WebP and try again")
  .regex(/^data:image\/[a-zA-Z+]+;base64,/, "Upload a valid image");

export const agentSignupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().regex(/^\+?[\d\s]{10,15}$/, "Enter a valid phone number"),
  city: z.string().trim().max(80).optional(),
  // Optional because a city may legitimately have no zones listed yet.
  area: z.string().trim().max(120).optional(),
  aadharNumber: z.string().regex(/^\d{12}$/, "Aadhar number must be 12 digits"),
  aadharFront: dataUri,
  aadharBack: dataUri,
  // Existing unverified agents may already have accepted in signup-basic.
  privacyAccepted: z.literal(true).optional(),
  termsAccepted: z.literal(true).optional(),
});

export const agentSignupBasicSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().regex(/^\+?[\d\s]{10,15}$/, "Enter a valid phone number"),
  city: z.string().trim().min(2, "Choose the city you'll work in"),
  area: z.string().trim().max(120).optional(),
  code: z.string().length(6, "Code must be 6 digits"),
  privacyAccepted: z.literal(true, { errorMap: () => ({ message: "Privacy Policy acceptance is required" }) }),
  termsAccepted: z.literal(true, { errorMap: () => ({ message: "Terms & Conditions acceptance is required" }) }),
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type CustomerSignupInput = z.infer<typeof customerSignupSchema>;
export type AgentSignupInput = z.infer<typeof agentSignupSchema>;
export type AgentSignupBasicInput = z.infer<typeof agentSignupBasicSchema>;
