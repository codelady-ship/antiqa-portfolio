/**
 * Persona assets (the figure of Antiqa that follows the scroll). Files live in
 * frontend/public/persona/ — see the README there.
 *
 * Until the film exists `film` stays null and the travelling figure is her photo
 * (src/components/persona/antiqa.webp, imported once, so Next serves one hashed copy) moved by
 * persona-traveler.tsx. The film: clips from Google Flow (docs/FLOW-PERSONA-PROMPTS.md), joined by
 * scripts/persona-film.mjs, which prints the `film` block below.
 */

/** Page chapters the figure reacts to (data-persona="…" on the sections). */
export type Chapter = "hero" | "skills" | "work" | "contact";

/** Poses for the slot figures: the direction she looks / leans. */
export type Pose = "idle" | "up" | "down" | "left" | "right";

type Section = "hero" | "about" | "work" | "contact";

/**
 * A scroll-scrubbed film (owner's "AI Character Portfolio" guide, 2026-11-16): one <video>, every
 * frame a keyframe, in a fixed stage behind the page. The scroll position picks the time:
 * on load the hero clip plays by itself up to `marks.hero`; after that each section holds on its
 * mark for the first `hold` share of the way to the next section (she stands while it is read),
 * then the film plays on to the next mark. See persona-film.tsx.
 */
export type Film = {
  /** H.264, all keyframes (-g 1), no audio: ≥ 1024 px … */
  desktop: string;
  /** … and phones / tablets */
  mobile: string;
  /** first frame, shown while the film loads (and the only picture with reduced motion) */
  poster: string;
  width: number;
  height: number;
  /** seconds */
  duration: number;
  /** film seconds where she has reached each section's pose (the end of its clip) */
  marks: { hero: number; about: number; work: number; contact?: number };
  /** share of the scroll between two sections spent holding on the first one's mark (0 … 0.9) */
  hold: number;
  /** where she stands in the film frame at each mark, 0 = left edge … 1 = right edge */
  focus: Partial<Record<Section, number>> & { hero: number };
  /**
   * where she should stand on the screen at each mark (≥ 1024 px; phones keep her centred),
   * 0 = left … 1 = right of the viewport; "belt" = the middle of the project belt
   * (owner: right in the hero, left in About, centre in Projects)
   */
  place: Partial<Record<Section, number | "belt">> & { hero: number | "belt" };
};

export const PERSONA: {
  /** the scroll-scrubbed film; null = the photo traveller (persona-traveler.tsx) */
  film: Film | null;
  /** pose stills for the slot figures; a missing pose = her photo, leaning (CSS) */
  poses: Partial<Record<Pose, string>>;
} = {
  film: null,
  // when the AI poses are ready, e.g.:
  // poses: { idle: "/persona/poses/idle.webp", up: "/persona/poses/up.webp", down: "/persona/poses/down.webp",
  //          left: "/persona/poses/left.webp", right: "/persona/poses/right.webp" },
  poses: {},
};
