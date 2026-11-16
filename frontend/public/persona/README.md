# Persona assets (the figure of Antiqa that follows the scroll)

Her photo is `src/components/persona/antiqa.webp` (677 × 800, a static import, so it is served
once as a hashed file). It is the figure until the film exists, and the small round photo on phones.
Prompts for Google Flow and the film script: `docs/FLOW-PERSONA-PROMPTS.md`.

## 1. Film — `film/` (the figure that follows the scroll)

`node scripts/persona-film.mjs clip1.mp4 clip2.mp4 …` writes:

| file | what |
| --- | --- |
| `film-1280.mp4` | desktop (≥ 1024 px): H.264, every frame a keyframe (`-g 1`), CRF 27, no audio, faststart |
| `film-854.mp4` | phones / tablets: the same, CRF 28 |
| `poster.jpg` | the first frame, shown while the film loads |

It then prints the `PERSONA.film` block for `config.ts`: the marks where each section's pose is reached,
the hold, and where she stands (`focus`) / should stand (`place`). Aim for ≤ 4 MB (desktop) and
≤ 2.5 MB (phones). A 16:9 cream studio (#FBF3EC): the edges are feathered into the page.
The old canvas frame sequence (`frames/`) is gone: an all-keyframe video seeks just as well and is
one request instead of a hundred.

## 2. Poses — `poses/` (the slot figures, all screen sizes)

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
