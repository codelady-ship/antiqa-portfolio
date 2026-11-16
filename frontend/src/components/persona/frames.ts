import { frameUrl } from "./config";

/* image-sequence player, shared by the stages and the travelling figure (one cache per page) */
const cache = new Map<number, HTMLImageElement>();
export function loadFrame(i: number) {
  let img = cache.get(i);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = frameUrl(i);
    cache.set(i, img);
  }
  return img;
}
/** Loads the frames of [first, last] coarse to fine (every 8th, then every 4th, …), 6 at a time. */
export async function preload(first: number, last: number, stop: () => boolean) {
  const order: number[] = [];
  const seen = new Set<number>();
  for (const step of [8, 4, 2, 1])
    for (let i = first; i <= last; i += step)
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
  for (let k = 0; k < order.length && !stop(); k += 6)
    await Promise.all(order.slice(k, k + 6).map((i) => loadFrame(i).decode().catch(() => {})));
}
export function nearestLoaded(i: number, first: number, last: number) {
  for (let d = 0; d <= last - first; d++)
    for (const j of [i - d, i + d]) {
      const img = j >= first && j <= last ? cache.get(j) : undefined;
      if (img?.complete && img.naturalWidth) return img;
    }
  return null;
}
