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

export const customerSignupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().regex(/^\+?[\d\s]{10,15}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
});

const dataUri = z.string().regex(/^data:image\/[a-zA-Z+]+;base64,/, "Upload a valid image");

export const agentSignupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().regex(/^\+?[\d\s]{10,15}$/, "Enter a valid phone number"),
  area: z.string().trim().min(2, "Enter the area / society you'll operate in"),
  aadharNumber: z.string().regex(/^\d{12}$/, "Aadhar number must be 12 digits"),
  aadharFront: dataUri,
  aadharBack: dataUri,
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type CustomerSignupInput = z.infer<typeof customerSignupSchema>;
export type AgentSignupInput = z.infer<typeof agentSignupSchema>;
