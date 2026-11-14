import type { Profile, Project } from "./types";

/**
 * Merge the API profile over the seed. The CV is merged on its own: the owner can upload a CV
 * in the admin panel before the profile document is ever saved (then `name` is still empty).
 */
export function mergeProfile(seed: Profile, p: Partial<Profile> | null | undefined): Profile {
  const base = p?.name ? { ...seed, ...p } : seed;
  return { ...base, cv: { ...seed.cv, ...p?.cv } } as Profile;
}

export type ProjectSort = "recommended" | "created" | "updated" | "stars";

const time = (d: string | null) => (d ? Date.parse(d) : 0);

/**
 * "recommended" is the admin order (same as the API): featured, then `order` desc, then newest.
 * The other options are visitor choices; featured projects stay first in every view.
 */
export function sortProjects(projects: Project[], sort: ProjectSort): Project[] {
  return [...projects].sort(
    (a, b) =>
      Number(b.featured) - Number(a.featured) ||
      (sort === "stars"
        ? b.stars - a.stars
        : sort === "updated"
          ? time(b.pushedAt) - time(a.pushedAt)
          : sort === "recommended"
            ? (b.order ?? 0) - (a.order ?? 0) || time(b.createdAt) - time(a.createdAt)
            : time(b.createdAt) - time(a.createdAt)),
  );
}
