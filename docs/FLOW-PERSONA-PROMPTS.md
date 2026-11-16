# Google Flow: the persona film and poses

The site shows a figure of Antiqa that follows the scroll. In the hero she waves on the right. In About she stands on the left while the text slides in from the right. In Projects she stands in the middle of the project belt.

Until the film exists, the figure is her photo (`frontend/src/components/persona/antiqa.webp`), moved by `persona-traveler.tsx`.

The film follows the owner's "AI Character Portfolio" guide (2026-11-16). It is one video, scrubbed by the scroll, in a fixed stage behind the page (`persona-film.tsx`).

Use **her photo** as the reference ("Ingredient") image: navy suit, light-blue shirt. The studio is **cream** like the page (not black), so the film's edges vanish into the page.

## 1. Start image (Flow → Image, 16:9, her photo as the ingredient)

> Use the person in the uploaded photo: same face, same long straight dark hair.
> OUTFIT: tailored navy-blue blazer, light-blue button-up shirt, navy trousers, white sneakers.
> POSE: full body, standing in the exact centre of the frame with her back to the camera, arms relaxed, head to toe visible.
> LIGHT: plain warm cream studio background (#FBF3EC), seamless, no floor line, soft even studio light, soft shadow under her feet, no props.
> STYLE: photorealistic, cinematic, 16:9 landscape.

## 2. Clips (Flow → Frames to Video, 16:9, Veo 3 Fast)

Each clip starts from the **last frame of the clip before** (clip 1 starts from the start image). Start every prompt with this base:

> SHOT: One single continuous camera shot with no cuts, no dissolves and no transitions.
> PERSON: The same young Azerbaijani woman with long straight dark hair, wearing a navy-blue blazer, light-blue shirt, navy trousers and white sneakers. Her face, hair and outfit stay exactly the same. Only one person in the frame.
> STUDIO: A plain seamless warm cream studio (#FBF3EC), soft even light, no walls, no lamps, no props except those named. Background stays plain cream.
> SOUND: No music, no dialogue.
> ACTION: …

| Clip | Section it ends in | ACTION |
| --- | --- | --- |
| `clip1.mp4` | hero | She stands with her back to the camera, slowly turns around to face the camera, smiles warmly and waves hello with her right hand. Static camera, full body. |
| `clip2.mp4` | About | She walks a few steps to the LEFT third of the frame, stops facing the camera, slight nod and confident smile. Static camera, full body. |
| `clip3.mp4` | (on the way) | She takes one step back and sits on a simple modern white chair; a white desk with an open silver laptop slides in from the right and stops in front of her; she starts typing, focused, small smile. Static camera. |
| `clip4.mp4` | Projects | She stops typing, stands up, steps out from behind the desk and walks to the exact CENTRE of the frame, stands still, hands loosely together, confident smile. The desk stays. Static camera. |
| `clip5.mp4` (optional) | Contact | She raises both hands, pulls down an invisible screen to chest height, then lowers her hands, smiles and waves. Static camera. |

Tips:
- Keep the camera static and the studio flat cream.
- If a clip crops her feet, add "full body, feet visible, camera at waist height" and generate again.
- Pick the best of the two outputs. Its last frame starts the next clip.

## 3. Build the film

You need ffmpeg (`winget install Gyan.FFmpeg`). Run this from `frontend/`:

```bash
node scripts/persona-film.mjs C:/Users/user/Downloads/clip1.mp4 C:/Users/user/Downloads/clip2.mp4 C:/Users/user/Downloads/clip3.mp4 C:/Users/user/Downloads/clip4.mp4
```

The script:
- joins the clips with a 0.25 s cross-fade;
- removes the Veo watermark (`--delogo x:y:w:h` moves the box; `--delogo none` turns it off);
- encodes `public/persona/film/film-1280.mp4` (desktop) and `film-854.mp4` (phones). Every frame is a keyframe, so seeking is instant. There is no audio, and faststart is on;
- makes `poster.jpg` from the first frame;
- prints the `film: { … }` block to paste into `src/components/persona/config.ts`.

With 4 clips the sections are `hero,about,-,work`; with 5 clips they are `hero,about,-,work,contact`. Use `--sections` to change this.

After pasting the block, check `focus` by eye. This is where she stands in the frame at each mark: 0 is the left edge and 1 is the right edge.

How the site uses the film:
- On load the hero clip plays by itself (the turn and the wave).
- After that, the scroll position sets the time. Each section holds on its pose while it is read (`hold`), and the film plays on to the next pose on the way down.
- The film moves sideways so she stands on the right in the hero, on the left in About and in the middle of the project belt (`place`). Phones keep her centred.
- The film loads after the page has loaded (fetch → blob, with a small progress pill). The poster shows until then.
- With reduced motion, the film does not run. The static figures stay.

When the clips are ready, tell Claude "flow hazır" and where they are (for example, Downloads). Claude runs the script, wires the film in and opens a PR.

## 4. Pose images (Image → 3:4), optional → `frontend/public/persona/poses/*.webp`

The slot figures use these. Without them, the photo leans instead. Base prompt for each:

> Full-body photo of the same woman as in the reference image, exactly the same face, long straight dark hair, wearing a tailored navy-blue suit with a light-blue shirt (soft blue tones), standing on a plain warm cream background (#FBF3EC), soft even studio light, no shadow on the background, centered, whole body visible from head to shoes with a little space above the head, vertical 3:4, photorealistic, no text, no logo.

| File | Add to the base prompt |
|---|---|
| `idle.webp` | standing confidently, hands loosely together, friendly smile, looking at the camera |
| `up.webp` | looking up and pointing up-right with her right hand |
| `down.webp` | looking down and pointing down-right with her right hand |
| `left.webp` | turned slightly left, pointing left with her left hand, looking left |
| `right.webp` | turned slightly right, pointing right with her right hand, looking right |
