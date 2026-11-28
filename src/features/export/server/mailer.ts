/**
 * Injectable mailer for "Email me the files". No dependency: the Resend adapter is one fetch call.
 * Nothing is sent unless RESEND_API_KEY is set; `mailerFromEnv()` returns null otherwise.
 */
import type { ExportBundle } from "../bundle";

export interface MailAttachment {
  filename: string;
  content: Buffer;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  attachments: MailAttachment[];
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export class MailerError extends Error {}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;

export function createResendMailer(options: { apiKey: string; from: string; fetchImpl?: FetchLike }): Mailer {
  const doFetch: FetchLike = options.fetchImpl ?? ((url, init) => fetch(url, init));
  return {
    async send(message) {
      const res = await doFetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: options.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          attachments: message.attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
        }),
      });
      if (!res.ok) throw new MailerError(`Email provider answered ${res.status}`);
    },
  };
}

/** The real mailer, or null when RESEND_API_KEY is not set (so no email can leave). */
export function mailerFromEnv(env: Record<string, string | undefined> = process.env): Mailer | null {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return null;
  return createResendMailer({ apiKey, from: env.EXPORT_FROM_EMAIL || "PitchSwipe <onboarding@resend.dev>" });
}

const MAX_ATTACHMENT_BYTES = 30 * 1024 * 1024;

export function emailMessage(to: string, bundle: ExportBundle, stamp: string): MailMessage {
  if (bundle.data.length > MAX_ATTACHMENT_BYTES) throw new MailerError("The files are too large to email. Download them instead.");
  return {
    to,
    subject: `Your PitchSwipe results (numbers as of ${stamp})`,
    text: `Your PitchSwipe results export is attached (${bundle.files.length} file${bundle.files.length === 1 ? "" : "s"}).\n\nNumbers as of ${stamp}. Groups under 10 swipers are grouped as "Other". Swipers stay anonymous.\n`,
    attachments: [{ filename: bundle.name, content: bundle.data }],
  };
}
