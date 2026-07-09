import { env, smsEnabled } from "../../config/env";

/**
 * Replaces placeholders in the DLT template.
 * Supports explicit {{otp}} placeholder and general DLT positional placeholders like ##var##, {#var#}, {%var%}.
 */
export function compileTemplate(template: string, code: string): string {
  // If the user explicitly uses {{otp}}, replace it directly
  if (template.includes("{{otp}}")) {
    return template.replace(/\{\{otp\}\}/g, code);
  }

  // Handle positional DLT placeholders (e.g., ##var##, {#var#}, {%var%})
  // Typically, the first variable is the application name (e.g. NexClean) and the second is the OTP code.
  let result = template;
  const placeholderRegex = /##var##|\{#var#\}|\{%var%\}/g;
  let matchCount = 0;

  result = result.replace(placeholderRegex, () => {
    matchCount++;
    if (matchCount === 1) {
      return "NexClean";
    }
    if (matchCount === 2) {
      return code;
    }
    return code; // Fallback in case of additional placeholders
  });

  return result;
}

/**
 * Sends an OTP SMS using SMSINDIAHUB.
 * Uses HTTP POST with application/x-www-form-urlencoded to prevent exposing credentials in URL logs.
 * Falls back to console logging if credentials are not configured (mock mode).
 */
export async function sendSmsOtp(phone: string, code: string): Promise<{ success: boolean; mocked: boolean }> {
  const template = env.smsIndiaHubTemplate;
  const message = compileTemplate(template, code);

  if (!smsEnabled) {
    console.log(`📲 [sms:mock] SMS to ${phone} (mocked): "${message}"`);
    return { success: true, mocked: true };
  }

  try {
    const url = "http://cloud.smsindiahub.in/vendorsms/pushsms.aspx";
    const cleanPhone = phone.replace(/^\+/, "");
    const bodyParams = new URLSearchParams({
      msisdn: cleanPhone,
      sid: env.smsIndiaHubSenderId,
      msg: message,
      fl: "0",
      gwid: env.smsIndiaHubGwid,
    });

    if (env.smsIndiaHubApiKey) {
      bodyParams.set("APIKey", env.smsIndiaHubApiKey);
    } else {
      bodyParams.set("user", env.smsIndiaHubUser);
      bodyParams.set("password", env.smsIndiaHubPassword);
    }

    if (env.smsIndiaHubEntityId) {
      bodyParams.set("entityid", env.smsIndiaHubEntityId);
    }
    if (env.smsIndiaHubTemplateId) {
      bodyParams.set("templateid", env.smsIndiaHubTemplateId);
    }

    console.log(`📡 Sending SMS via SMSINDIAHUB to ${phone}...`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseText = await response.text();
    console.log(`📥 SMSINDIAHUB API Raw Response:`, responseText);

    // Try parsing as JSON to check error codes
    try {
      const responseJson = JSON.parse(responseText);
      if (responseJson.ErrorCode && responseJson.ErrorCode !== "000") {
        throw new Error(
          `SMSINDIAHUB API Error Code ${responseJson.ErrorCode}: ${responseJson.ErrorMessage || "Unknown Error"}`
        );
      }
    } catch (parseErr) {
      // Non-JSON response fallback: check for typical failure words in raw text
      const lower = responseText.toLowerCase();
      if (lower.includes("error") || lower.includes("fail") || lower.includes("invalid")) {
        throw new Error(`SMSINDIAHUB Response indicates failure: ${responseText}`);
      }
    }

    console.log(`✓ SMS successfully dispatched to ${phone}`);
    return { success: true, mocked: false };
  } catch (err) {
    console.error(`✗ SMS dispatch to ${phone} failed:`, (err as Error).message);
    throw err;
  }
}
