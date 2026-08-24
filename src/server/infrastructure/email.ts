import { captureServerError } from "./error-tracker";

interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendResendEmail(input: EmailInput): Promise<"sent" | "not_configured"> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return "not_configured";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "User-Agent": "outrank/1.0" },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Resend returned ${response.status}`);
    return "sent";
  } catch (error) {
    captureServerError("email.resend_failed", error);
    throw error;
  }
}
