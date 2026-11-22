import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AdminAuth, connectDb } from "./models.js";

export const COOKIE = "admin_session";
const WEEK = 7 * 24 * 3600;

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
  return s;
}

/** What the database knows about the admin login (see AdminAuth in models.ts). */
export interface AuthState {
  /** set by a password reset; absent = ADMIN_PASSWORD_HASH from the environment is the password */
  passwordHash?: string;
  sessionVersion: number;
  reset?: { hash: string; expiresAt: Date };
}

export interface AuthStore {
  get(): Promise<AuthState>;
  /** stores the hash of a new reset token; any earlier token stops working */
  setReset(hash: string, expiresAt: Date): Promise<void>;
  /**
   * Atomically: if this unexpired token hash is the pending one, remove it, store the new password hash
   * and sign every session out. false = the token was wrong, expired or already used (also by a parallel request).
   */
  consumeReset(hash: string, now: Date, passwordHash: string): Promise<boolean>;
}

const ADMIN_ID = "admin";

export const mongoAuth: AuthStore = {
  async get() {
    await connectDb();
    const d: any = await AdminAuth.findById(ADMIN_ID).lean();
    return {
      passwordHash: d?.passwordHash || undefined,
      sessionVersion: d?.sessionVersion ?? 0,
      reset: d?.reset?.hash && d.reset.expiresAt ? { hash: d.reset.hash, expiresAt: new Date(d.reset.expiresAt) } : undefined,
    };
  },
  async setReset(hash, expiresAt) {
    await connectDb();
    await AdminAuth.updateOne({ _id: ADMIN_ID }, { $set: { reset: { hash, expiresAt } } }, { upsert: true });
  },
  async consumeReset(hash, now, passwordHash) {
    await connectDb();
    const r = await AdminAuth.updateOne(
      { _id: ADMIN_ID, "reset.hash": hash, "reset.expiresAt": { $gt: now } },
      { $set: { passwordHash, passwordChangedAt: now }, $inc: { sessionVersion: 1 }, $unset: { reset: 1 } },
    );
    return r.modifiedCount === 1;
  },
};

/** In-memory store with the same semantics, for tests. */
export function memoryAuth(): AuthStore & { state: AuthState } {
  const store = {
    state: { sessionVersion: 0 } as AuthState,
    async get() {
      await Promise.resolve();
      return { ...store.state };
    },
    async setReset(hash: string, expiresAt: Date) {
      store.state.reset = { hash, expiresAt };
    },
    async consumeReset(hash: string, now: Date, passwordHash: string) {
      await Promise.resolve();
      const r = store.state.reset;
      // check and write in one synchronous step, like the single Mongo update
      if (!r || r.hash !== hash || r.expiresAt <= now) return false;
      store.state = { passwordHash, sessionVersion: store.state.sessionVersion + 1 };
      return true;
    },
  };
  return store;
}

/**
 * Checks the login against the password hash from the database (after a reset in the panel),
 * else ADMIN_PASSWORD_HASH. Returns the session version to sign into the cookie, or null.
 */
export async function checkCredentials(email: string, password: string, store: AuthStore) {
  const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
  const { passwordHash, sessionVersion } = await store.get();
  const hash = passwordHash || process.env.ADMIN_PASSWORD_HASH || "";
  if (!adminEmail || !hash) return null;
  // always run bcrypt so timing does not reveal whether the email matched
  const ok = await bcrypt.compare(password, hash);
  return ok && email.toLowerCase() === adminEmail ? { sessionVersion } : null;
}

export function issueSession(res: Response, sessionVersion: number) {
  const token = jwt.sign({ role: "admin", sv: sessionVersion }, secret(), { expiresIn: WEEK });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: WEEK * 1000,
    path: "/",
  });
}

/**
 * "Known device" cookie, set after a successful login. Its holder gets its own rate-limit key
 * instead of the IP + global keys, so attackers (or many visitors behind one proxy IP)
 * cannot lock the owner out of the browser she already used.
 */
export const DEVICE_COOKIE = "admin_device";
const DEVICE_AGE = 180 * 24 * 3600;

export function deviceId(req: Request): string | null {
  const token = req.cookies?.[DEVICE_COOKIE];
  if (!token) return null;
  try {
    const { dev } = jwt.verify(token, secret()) as { dev?: unknown };
    return typeof dev === "string" && /^[a-f0-9]{32}$/.test(dev) ? dev : null;
  } catch {
    return null;
  }
}

export function issueDevice(res: Response, dev: string) {
  res.cookie(DEVICE_COOKIE, jwt.sign({ dev }, secret(), { expiresIn: DEVICE_AGE }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: DEVICE_AGE * 1000,
    path: "/api/auth",
  });
}

/**
 * A valid session cookie issued under the current session version. The database is read only for a
 * cookie whose signature is good; a cookie from before the version existed counts as version 0, so
 * nobody is signed out until the first password reset.
 */
export async function isAdmin(req: Request, store: AuthStore) {
  const token = req.cookies?.[COOKIE];
  if (!token) return false;
  let claims: { role?: string; sv?: unknown };
  try {
    claims = jwt.verify(token, secret()) as typeof claims;
  } catch {
    return false;
  }
  if (claims.role !== "admin") return false;
  return (typeof claims.sv === "number" ? claims.sv : 0) === (await store.get()).sessionVersion;
}

export const requireAdminWith = (store: AuthStore) => (req: Request, res: Response, next: NextFunction) => {
  isAdmin(req, store).then((ok) => (ok ? next() : res.status(401).json({ error: "unauthorized" })), next);
};
