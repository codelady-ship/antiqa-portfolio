# Persona assets (the figure of Antiqa that follows the scroll)

Nothing here yet: until these files exist, the site draws a placeholder from her photo
(`frontend/src/components/hero/antiqa.jpg`). After adding files, switch them on in
`frontend/src/components/persona/config.ts` (`PERSONA.frames` / `PERSONA.poses`).

## 1. Scroll sequence — `frames/` (hero, skills and contact chapters, desktop ≥ 1024 px)

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

Making them from an AI video: export the clip as PNGs (`ffmpeg -i persona.mp4 -vf fps=24 f%04d.png`),
remove the background, then `cwebp -q 80 -alpha_q 90 f0001.png -o 0001.webp` (or `sharp`).
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
