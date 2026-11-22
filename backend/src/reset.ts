/** Password reset helpers: token, link, mail texts, password rules. The routes are in app.ts. */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Mail } from "./mailer.js";

export const RESET_TTL_MIN = 30;
export const RESET_TTL_MS = RESET_TTL_MIN * 60_000;
export const PASSWORD_MIN = 10;
/** bcrypt reads only the first 72 bytes: a longer password would be cut silently */
export const PASSWORD_MAX_BYTES = 72;
/** the same cost as scripts/hash-password.mjs */
export const BCRYPT_COST = 12;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** 32 random bytes; only the SHA-256 hash is stored, the token itself exists in the mail alone. */
export function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

/** Constant-time string comparison (both sides hashed to one length first, so the length does not leak either). */
export function safeEqual(a: string, b: string) {
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(a), h(b));
}

/**
 * Where the reset link points: SITE_URL if it is one of the site's own addresses, else the first of them.
 * Never the request's Host / Origin / Referer. null = SITE_URL is set to something that is not the site.
 */
export function resetSiteUrl(allowed: readonly string[]): string | null {
  const raw = (process.env.SITE_URL || "").trim().replace(/\/+$/, "");
  if (!raw) return allowed[0] ?? null;
  if (allowed.includes(raw)) return raw;
  // local development only (NODE_ENV is "production" on every Vercel deployment)
  if (process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/.test(raw)) return raw;
  return null;
}

/** The token travels in the URL fragment: it is not sent to any server, not logged and not in a Referer. */
export const resetLink = (site: string, locale: "az" | "en", token: string) => `${site}/${locale}/admin/reset#token=${token}`;

export type PasswordProblem = "mismatch" | "short" | "long" | "email";

export function passwordProblem(password: string, confirm: string, adminEmail: string): PasswordProblem | null {
  if (password !== confirm) return "mismatch";
  if ([...password].length < PASSWORD_MIN) return "short";
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) return "long";
  if (adminEmail && password.trim().toLowerCase() === adminEmail.trim().toLowerCase()) return "email";
  return null;
}

export function resetMail(link: string): Mail {
  return {
    subject: "Admin panel: şifrənin yenilənməsi / password reset",
    text: [
      "Salam!",
      "",
      "Portfolio admin paneli üçün şifrənin yenilənməsi istənildi. Yeni şifrə təyin etmək üçün bu linki açın:",
      "",
      link,
      "",
      `Link ${RESET_TTL_MIN} dəqiqə keçərlidir və yalnız bir dəfə işləyir.`,
      "Bunu siz istəməmisinizsə, bu məktuba əhəmiyyət verməyin: şifrəniz dəyişməyib.",
      "",
      "—",
      "",
      "Hello!",
      "",
      "A password reset was requested for the portfolio admin panel. Open this link to set a new password:",
      "",
      link,
      "",
      `The link is valid for ${RESET_TTL_MIN} minutes and works only once.`,
      "If you did not ask for this, ignore this e-mail: your password has not changed.",
    ].join("\n"),
  };
}

export function changedMail(): Mail {
  return {
    subject: "Admin panel: şifrə dəyişdirildi / password changed",
    text: [
      "Salam!",
      "",
      "Portfolio admin panelinin şifrəsi indicə dəyişdirildi. Bütün açıq sessiyalar bağlandı.",
      "Bunu siz etməmisinizsə, admin giriş səhifəsində “Şifrəni unutmusunuz?” linki ilə şifrəni dərhal yeniləyin.",
      "",
      "—",
      "",
      "Hello!",
      "",
      "The password of the portfolio admin panel has just been changed. All open sessions were signed out.",
      "If this was not you, reset the password right away with “Forgot password?” on the admin sign-in page.",
    ].join("\n"),
  };
}
