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
