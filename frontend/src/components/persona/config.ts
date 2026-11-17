/**
 * Her videos, one per section (owner, 2026-11-17): she no longer travels between sections. When a
 * section comes into view she appears there (fade + scale) and does her movement. Made from the
 * Google Flow / Veo clips by `node scripts/persona-clips.mjs` (files in public/persona/clips/).
 * Desktop (≥ 1024 px) only; phones keep the static page. With reduced motion the poster (a still
 * frame) shows instead of the video.
 */
export type Clip = {
  /** VP9 WebM with an alpha channel: her cut out of the studio (Chrome, Edge, Firefox) */
  alpha?: string;
  /** H.264 with the cream studio, no audio: the fallback where WebM alpha does not work (Safari), feathered by CSS */
  src: string;
  /** a still frame (first frame, cut out: transparent WebP), shown until the video plays and with reduced motion */
  poster: string;
  width: number;
  height: number;
};

export type PointClip = Clip & {
  /** seconds: she stands at rest (the clip starts / reverses here) */
  rest: number;
  /** seconds: her arm is out, towards the plate; the video holds on this frame while a plate is hovered */
  hold: number;
  /** the side she points to in the file itself; the other side is the same video mirrored (CSS) */
  faces: "left" | "right";
};

export const PERSONA: {
  /** hero (right) and contact: she waves (a short loop) */
  wave: Clip;
  /** About: she sits down at the desk and types; scrubbed by the scroll (every frame a keyframe) */
  desk: Clip;
  /**
   * Projects: she points at the hovered plate. For now cut from the wave (its arm-raise part,
   * 0 … 1.5 s): her right arm goes out sideways, to the viewer's left. When the real pointing clip
   * (clip4) is ready: `node scripts/persona-clips.mjs --wave clip1.mp4 --desk clip3.mp4 --point clip4.mp4`,
   * then set `rest`, `hold`, `faces` and the size here.
   */
  point: PointClip;
} = {
  wave: { alpha: "/persona/clips/wave.webm", src: "/persona/clips/wave.mp4", poster: "/persona/clips/wave.webp", width: 432, height: 640 },
  desk: { alpha: "/persona/clips/desk.webm", src: "/persona/clips/desk.mp4", poster: "/persona/clips/desk.webp", width: 720, height: 540 },
  point: {
    alpha: "/persona/clips/point.webm",
    src: "/persona/clips/point.mp4",
    poster: "/persona/clips/point.webp",
    width: 360,
    height: 534,
    rest: 0.4,
    hold: 0.88,
    faces: "left",
  },
};
