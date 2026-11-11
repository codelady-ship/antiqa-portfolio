import { revalidateTag } from "next/cache";

const API_URL = process.env.API_URL?.replace(/\/$/, "");

/**
 * Called by the admin panel after a save. Only an admin session (checked by the API
 * with the same cookie) may expire the cached profile / project data.
 */
export async function POST(req: Request) {
  if (!API_URL) return Response.json({ error: "no api" }, { status: 503 });
  const me = await fetch(`${API_URL}/api/auth/me`, { headers: { cookie: req.headers.get("cookie") ?? "" }, cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ admin: boolean }>) : { admin: false }))
    .catch(() => ({ admin: false }));
  if (!me.admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  revalidateTag("profile", { expire: 0 });
  revalidateTag("projects", { expire: 0 });
  return Response.json({ ok: true });
}
