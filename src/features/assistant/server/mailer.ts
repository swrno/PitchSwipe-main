/** Small injectable mailer. No real sending unless RESEND_API_KEY is set (server env). No dependency: plain fetch. */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  /** Resolves true when handed to the provider; false when skipped or failed. Never throws. */
  send(message: MailMessage): Promise<boolean>;
}

export const noopMailer: Mailer = {
  async send() {
    return false;
  },
};

export function createResendMailer(options: { apiKey: string; from: string; fetchFn?: typeof fetch }): Mailer {
  const doFetch = options.fetchFn ?? fetch;
  return {
    async send(m) {
      try {
        const res = await doFetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { authorization: `Bearer ${options.apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({ from: options.from, to: [m.to], subject: m.subject, text: m.text, html: m.html }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}

export function defaultMailer(env: Record<string, string | undefined> = process.env): Mailer {
  if (!env.RESEND_API_KEY) return noopMailer;
  return createResendMailer({ apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM_EMAIL || "PitchSwipe <onboarding@resend.dev>" });
}
