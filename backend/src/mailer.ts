/**
 * Outgoing mail for the admin (password reset link, "password changed" notice).
 * Resend's HTTPS API through fetch: no SMTP sockets and no extra package on a serverless function.
 * The recipient is ALWAYS the ADMIN_EMAIL of the server environment, never an address from a request.
 */
export interface Mail {
  subject: string;
  text: string;
}

export interface Mailer {
  /** null = ready to send; otherwise the reason (variable NAMES only, never a value) for the server log */
  problem(): string | null;
  /** sends to the configured admin address; throws MailError when the provider refuses */
  send(mail: Mail): Promise<void>;
}

/** Its message is written by this file and is safe to log (no key, no address, no mail text). */
export class MailError extends Error {}

const DEFAULT_FROM = "Antiqa Portfolio <onboarding@resend.dev>";

export const resendMailer: Mailer = {
  problem() {
    // a preview deployment would mail links that open the production site: only production sends
    if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return "mail is switched off on preview deployments";
    const missing = ["RESEND_API_KEY", "ADMIN_EMAIL"].filter((k) => !process.env[k]?.trim());
    return missing.length ? `${missing.join(" and ")} not set` : null;
  },
  async send({ subject, text }) {
    const problem = this.problem();
    if (problem) throw new MailError(problem);
    let r: Response;
    try {
      r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json" },
        // plain text only: nothing for the provider to rewrite into tracking links
        body: JSON.stringify({ from: process.env.MAIL_FROM?.trim() || DEFAULT_FROM, to: [process.env.ADMIN_EMAIL!.trim()], subject, text }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      throw new MailError(`mail provider unreachable (${e instanceof Error ? e.name : "error"})`);
    }
    void r.body?.cancel();
    if (!r.ok) throw new MailError(`mail provider answered HTTP ${r.status}`);
  },
};
