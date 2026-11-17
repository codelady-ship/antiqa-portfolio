# Persona assets (Antiqa's figure on the home page)

Her photo is `src/components/persona/antiqa.webp` (677 × 800, a static import, served once as a
hashed file). Phones and tablets (< 1024 px) show it in the middle of the project belt.

## Clips — `clips/` (owner, 2026-11-17: one video per section, no travelling figure)

`node scripts/persona-clips.mjs --wave clip1.mp4 --desk clip3.mp4 [--point clip4.mp4]` (run from
`frontend/`) writes:

| file | where | encoding |
| --- | --- | --- |
| `wave.mp4` / `wave.webp` | hero (right) and contact: she waves | 432 × 640, CRF 28, a normal GOP, loops |
| `desk.mp4` / `desk.webp` | About (left, sticky): she sits down at the desk and types, scrubbed by the scroll | 720 × 540, CRF 30, every frame a keyframe (`-g 1`) |
| `point.mp4` / `point.webp` | Projects (middle of the belt): she points at the hovered plate | 360 × 534, `-g 1` (played forwards and backwards) |

The `.webp` is the first frame: the server HTML shows it, and it stays the picture with reduced
motion. The 2 px black lines at the top and bottom of the Veo clips are cropped; nothing else is
removed. Until clip4 (pointing) exists, `point.mp4` is cut from the wave (0–1.5 s, the arm going
out); after re-running with `--point`, set `rest` / `hold` / `faces` in `src/components/persona/config.ts`.

## Poses — `poses/` (optional stills)

Transparent WebP, same 677 × 800 box, her feet at the bottom edge. ≤ 60 KB each.
