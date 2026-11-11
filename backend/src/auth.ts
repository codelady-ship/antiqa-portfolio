import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const COOKIE = "admin_session";
const WEEK = 7 * 24 * 3600;

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");
  return s;
}

export async function checkCredentials(email: string, password: string) {
  const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase();
  const hash = process.env.ADMIN_PASSWORD_HASH || "";
  if (!adminEmail || !hash) return false;
  // always run bcrypt so timing does not reveal whether the email matched
  const ok = await bcrypt.compare(password, hash);
  return ok && email.toLowerCase() === adminEmail;
}

export function issueSession(res: Response) {
  const token = jwt.sign({ role: "admin" }, secret(), { expiresIn: WEEK });
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

export function isAdmin(req: Request) {
  const token = req.cookies?.[COOKIE];
  if (!token) return false;
  try {
    return (jwt.verify(token, secret()) as { role?: string }).role === "admin";
  } catch {
    return false;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isAdmin(req)) return res.status(401).json({ error: "unauthorized" });
  next();
}
