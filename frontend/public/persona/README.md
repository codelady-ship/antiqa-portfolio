# Persona assets (the figure of Antiqa that follows the scroll)

Her photo is `src/components/persona/antiqa.webp` (677 × 800, a static import, so it is served
once as a hashed file). It is the figure until real assets exist, and the small round
photo on phones. After adding frames or poses, switch them on in
`frontend/src/components/persona/config.ts` (`PERSONA.frames` / `PERSONA.poses`).
Prompts for Google Flow and the frame script: `docs/FLOW-PERSONA-PROMPTS.md`.

## 1. Scroll sequence — `frames/` (the travelling figure and the contact stage, desktop ≥ 1024 px)

- One full-body cut-out of her per frame, **transparent WebP**, same size for every frame,
  portrait **677 × 800** (or any size with that ratio, ≤ 900 px tall). Aim for ≤ 25 KB per frame.
- Names: `0001.webp`, `0002.webp`, … (4 digits, 1-based, no gaps).
- 24 – 30 frames per second of motion is plenty; ~90 – 150 frames in total.
- Chapter ranges go in `config.ts`, e.g.
  `chapters: { hero: [1, 40], skills: [41, 90], contact: [91, 130] }`
  - hero: standing, waves to the visitor
  - skills: gestures / counts on her fingers while the tech chips float around
  - contact: waves goodbye / points to the contact links
- Frames are scrubbed by scroll position (not played in real time), loaded only after the page
  has loaded, coarse to fine (every 8th frame first), so the page never waits for them.

Making them from an AI video: `node scripts/persona-frames.mjs persona.mp4 --frames 72 --idle`
(ffmpeg; cuts the clip evenly, keys out the cream background, prints the config block).
A scroll-scrubbed `<video>` is not used: seeking is unreliable on many browsers unless every
frame is a keyframe, and transparent video is poorly supported.

## 2. Poses — `poses/` (the project ring, all screen sizes)

Transparent WebP, same 677 × 800 box, her feet at the bottom edge:

| file | when |
| --- | --- |
| `idle.webp` | nothing hovered: standing, looking at the visitor |
| `up.webp` | a card above her is hovered: looks and points up |
| `down.webp` | a card below her: looks and points down |
| `left.webp` | a card on the visitor's left: turns and points left |
| `right.webp` | a card on the visitor's right: turns and points right |

The speech bubble sits at her mouth on her right side (the visitor's right), so leave a little
room there. ≤ 60 KB each.
