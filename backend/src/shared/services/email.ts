import { emailEnabled, env, isProd } from "../../config/env";
import { ApiError } from "../utils/ApiError";

/** Deliver the short-lived admin password-reset code without exposing it to the browser. */
export async function sendAdminPasswordResetEmail(email: string, code: string): Promise<void> {
  if (!emailEnabled) {
    if (isProd) {
      throw ApiError.serviceUnavailable("Password-reset email is temporarily unavailable");
    }
    console.log(`[email:mock] Admin password reset for ${email}: ${code}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [email],
      subject: "Your NexClean admin password reset code",
      text: `Your NexClean admin password reset code is ${code}. It expires in ${env.otpExpiryMin} minutes. If you did not request this, you can ignore this email.`,
      html: `<p>Your NexClean admin password reset code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in ${env.otpExpiryMin} minutes. If you did not request this, you can ignore this email.</p>`,
    }),
  });

  if (!response.ok) {
    console.error(`[email] Resend rejected admin reset email (${response.status})`);
    throw ApiError.serviceUnavailable("Password-reset email is temporarily unavailable");
  }
}
