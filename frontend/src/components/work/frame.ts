/**
 * allow-scripts + allow-same-origin would give a demo on THIS origin full access to the page,
 * so only https demos on other origins are framed. The portfolio's other addresses (the second
 * production domain, Vercel previews) are not framed either: they refuse framing anyway
 * (X-Frame-Options DENY), and the API rejects them as demo/admin links.
 */
const OWN_HOST = /^(antiqa-portfolio|antiqacode)(-[a-z0-9-]+)?\.vercel\.app$/;

export function isSafeFrame(url: string) {
  try {
    const u = new URL(url);
    if (OWN_HOST.test(u.hostname.replace(/\.+$/, ""))) return false;
    return u.protocol === "https:" && (typeof location === "undefined" || u.origin !== location.origin);
  } catch {
    return false;
  }
}
