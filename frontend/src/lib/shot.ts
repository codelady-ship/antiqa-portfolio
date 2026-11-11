/** Screenshot thumbnail (free WordPress mShots service) for cards and the 3D sphere. */
export const shot = (url: string, w = 640) =>
  `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=${w}&h=${Math.round(w * 0.625)}`;
