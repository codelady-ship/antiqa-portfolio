import { revalidateTag } from "next/cache";

const API_URL = process.env.API_URL?.replace(/\/$/, "");

/**
 * Called by the admin panel after a save, and by backend/scripts/upsert-projects.ts after its
 * database writes. Only an admin session (checked by the API with the same cookie) or the
 * CRON_SECRET bearer token may expire the cached profile / project data.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return expire();
  if (!API_URL) return Response.json({ error: "no api" }, { status: 503 });
  const me = await fetch(`${API_URL}/api/auth/me`, { headers: { cookie: req.headers.get("cookie") ?? "" }, cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<{ admin: boolean }>) : { admin: false }))
    .catch(() => ({ admin: false }));
  if (!me.admin) return Response.json({ error: "unauthorized" }, { status: 401 });
  return expire();
}

function expire() {
  revalidateTag("profile", { expire: 0 });
  revalidateTag("projects", { expire: 0 });
  return Response.json({ ok: true });
}
