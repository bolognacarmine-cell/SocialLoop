import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";

export type MailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string | null;
};

export type MailResult = {
  providerId: string;
  provider: "mock" | "smtp";
};

/**
 * Provider-agnostic mailer. The mock provider is the default so local demo
 * workflows never send real email. Swap this implementation with Postmark,
 * Resend, SES or SMTP in production.
 */
export async function sendMail(input: MailInput): Promise<MailResult> {
  if (!input.to.includes("@")) throw new Error("Destinatario email non valido");
  if (!input.subject.trim()) throw new Error("Oggetto email obbligatorio");

  const providerId = `mock_${randomUUID()}`;
  if (process.env.NODE_ENV === "development") {
    console.info("[email:mock]", {
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      preview: input.text?.slice(0, 160) ?? input.html.replace(/<[^>]+>/g, " ").slice(0, 160)
    });
  }

  return { providerId, provider: "mock" };
}
