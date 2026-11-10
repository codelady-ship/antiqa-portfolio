/**
 * allow-scripts + allow-same-origin would give a demo on THIS origin full access to the page,
 * so only https demos on other origins are framed.
 */
export function isSafeFrame(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (typeof location === "undefined" || u.origin !== location.origin);
  } catch {
    return false;
  }
}
