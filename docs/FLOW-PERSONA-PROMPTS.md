# Google Flow: the persona video and poses

The site shows a figure of Antiqa that follows the scroll on desktop. In the hero she waves on the right. In About she stands on the left while the text slides in from the right. In Projects she stands in the middle of the ring.

Until the Flow assets exist, the figure is her photo (`frontend/public/persona/antiqa.webp`).

Use **her photo** as the reference ("Ingredient") image: navy suit, light-blue shirt. Make the images first, then the video.

## Base prompt (start every prompt with this)

> Full-body photo of the same woman as in the reference image, exactly the same face, long straight dark hair, wearing a tailored navy-blue suit with a light-blue shirt (soft blue tones), standing on a plain warm cream background (#FBF3EC), soft even studio light, no shadow on the background, centered, whole body visible from head to shoes with a little space above the head, vertical 3:4, photorealistic, no text, no logo.

## 1. Video (Video → 8 s, vertical 9:16 or 3:4) → `persona.mp4`

> [base prompt] She looks at the camera and waves hello with her right hand, then lowers her hand and turns slightly to her left, then turns back and stands confidently with her hands loosely together in front of her, smiling. Static camera, no zoom, no cuts, same background and light throughout, smooth natural motion.

Tips:
- Keep the camera static and the background flat. The script turns the cream background transparent, so a flat background gives clean edges.
- If the first try crops her feet, add "full body, feet visible, camera at waist height" and generate again.

## 2. Pose images (Image → 3:4), optional → `frontend/public/persona/poses/*.webp`

The ring uses these when a project card is hovered. Without them, the photo leans instead.

| File | Add to the base prompt |
|---|---|
| `idle.webp` | standing confidently, hands loosely together, friendly smile, looking at the camera |
| `up.webp` | looking up and pointing up-right with her right hand |
| `down.webp` | looking down and pointing down-right with her right hand |
| `left.webp` | turned slightly left, pointing left with her left hand, looking left |
| `right.webp` | turned slightly right, pointing right with her right hand, looking right |

## 3. Turn the video into scroll frames

You need ffmpeg (`winget install Gyan.FFmpeg`). Run these from `frontend/`:

```bash
node scripts/persona-frames.mjs "C:/Users/user/Downloads/persona.mp4" --frames 72 --idle
```

- This writes `public/persona/frames/0001.webp … 0072.webp`: 720 px wide, with the cream background made transparent.
- With `--idle`, the last frame is also saved as `poses/idle.webp`.
- It then prints the `frames: { … }` block to paste into `src/components/persona/config.ts`.

Options:
- `--frames 60–90` sets how many frames to make.
- `--width` sets the frame width in pixels.
- `--key none` keeps the background.
- `--similarity 0.08–0.2` sets how much of the cream counts as background. Raise it if a cream halo is left; lower it if parts of her disappear.

How the site uses the frames:
- The frames are drawn on a canvas as the page scrolls, not played as a video. About the first 45 % of the frames run while she travels from the hero to About (the wave and the turn). The rest run on the way down to the projects.
- Frames load only after the page has loaded, coarse to fine, so the first paint never waits for them.
- If no frames are set, the site falls back to the pose images, then to the photo.
- With reduced motion and below 1024 px, the frames are not used.

When the files are ready, tell Claude "flow hazır" and where they are (for example, Downloads). Claude runs the script, wires the frames in and opens a PR.
