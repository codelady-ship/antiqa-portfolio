/**
 * Persona assets (the cut-out figure of Antiqa that follows the scroll). Files live in
 * frontend/public/persona/ — see the README there for sizes and encoding.
 *
 * Until the real assets exist both entries stay empty and the components draw a placeholder
 * from her photo (public/persona/antiqa.webp) with scroll-linked CSS transforms.
 * Frames: scripts/persona-frames.mjs prints this block from a video (docs/FLOW-PERSONA-PROMPTS.md).
 */

/** Page chapters the figure reacts to (data-persona="…" on the sections). */
export type Chapter = "hero" | "skills" | "work" | "contact";

/** Poses for the project ring: the direction is where the hovered card is, as the visitor sees it. */
export type Pose = "idle" | "up" | "down" | "left" | "right";

export type FrameSequence = {
  /** number of frames: files 0001.webp … NNNN.webp in /persona/frames/ */
  count: number;
  width: number;
  height: number;
  /** frame range [first, last] (1-based, inclusive) played while each chapter scrolls past */
  chapters: Record<Exclude<Chapter, "work">, [number, number]>;
};

export const PERSONA: {
  /** scroll-scrubbed image sequence for the hero, skills and contact chapters; null = placeholder */
  frames: FrameSequence | null;
  /** pose stills for the project ring and phones; a missing pose = placeholder */
  poses: Partial<Record<Pose, string>>;
} = {
  frames: null,
  // when the AI poses are ready, e.g.:
  // poses: { idle: "/persona/poses/idle.webp", up: "/persona/poses/up.webp", down: "/persona/poses/down.webp",
  //          left: "/persona/poses/left.webp", right: "/persona/poses/right.webp" },
  poses: {},
};

export const frameUrl = (i: number) => `/persona/frames/${String(i).padStart(4, "0")}.webp`;
